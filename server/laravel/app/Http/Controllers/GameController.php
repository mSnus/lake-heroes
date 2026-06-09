<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GamePlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameController extends Controller
{
    // POST /api/games  { state: "<json string>" }
    // Creates the shared game plus one join code per player slot.
    public function store(Request $req)
    {
        $data = $req->validate(['state' => 'required|string|max:262144']);

        $parsed = json_decode($data['state'], true);
        abort_unless(
            isset($parsed['players']) && is_array($parsed['players']) && count($parsed['players']) > 0,
            422,
            'state.players missing or empty'
        );

        return DB::transaction(function () use ($data, $parsed) {
            $game = Game::create([
                'state' => $data['state'],
                'version' => 1,
                'status' => 'active',
            ]);

            $codes = [];
            foreach ($parsed['players'] as $i => $p) {
                $code = $this->uniqueCode();
                GamePlayer::create([
                    'code' => $code,
                    'game_id' => $game->id,
                    'player_index' => $i,
                    'color' => $p['color'] ?? '',
                    'name' => $p['name'] ?? "Player $i",
                ]);
                $codes[] = [
                    'code' => $code,
                    'playerIndex' => $i,
                    'color' => $p['color'] ?? '',
                    'name' => $p['name'] ?? "Player $i",
                ];
            }

            return response()->json(['codes' => $codes, 'version' => 1]);
        });
    }

    // GET /api/games/{code}
    public function show(string $code)
    {
        $slot = $this->slot($code);
        $game = $slot->game;

        return response()->json([
            'state' => $game->state,
            'version' => $game->version,
            'status' => $game->status,
            'playerIndex' => $slot->player_index,
            'color' => $slot->color,
        ]);
    }

    // PUT /api/games/{code}/state  { state, version }
    public function update(Request $req, string $code)
    {
        $data = $req->validate([
            'state' => 'required|string|max:262144',
            'version' => 'required|integer',
        ]);

        return DB::transaction(function () use ($data, $code) {
            $slot = $this->slot($code);
            $game = Game::whereKey($slot->game_id)->lockForUpdate()->first();

            // Optimistic concurrency: reject stale writes so two clients can't clobber.
            if ((int) $data['version'] !== (int) $game->version) {
                return response()->json(['error' => 'stale', 'version' => $game->version], 409);
            }

            $parsed = json_decode($data['state'], true);
            $game->update([
                'state' => $data['state'],
                'version' => $game->version + 1,
                'status' => !empty($parsed['gameOver']) ? 'finished' : 'active',
            ]);

            return response()->json(['version' => $game->version]);
        });
    }

    private function slot(string $code): GamePlayer
    {
        return GamePlayer::with('game')->findOrFail(strtoupper($code));
    }

    private function uniqueCode(): string
    {
        // Unambiguous alphanumerics (no 0/O/1/I) for easy sharing.
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (GamePlayer::whereKey($code)->exists());

        return $code;
    }
}
