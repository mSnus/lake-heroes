<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GamePlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GameController extends Controller
{
    /** `games.state` is longText (4GB); this is just a sanity bound. A long
     * 6-player game runs to a few hundred KB -- turnStats grows one row per
     * player per turn -- so the previous 256KB was reachable in real play. */
    private const MAX_STATE_BYTES = 1048576;

    /** Events inlined into a /version reply. More than this and the client
     * simply jumps its cursor -- it has fallen too far behind for the missed
     * narration to still be interesting. */
    private const EVENTS_PER_POLL = 10;

    /** Rows kept per game. At ~5 events a turn that is ~40 turns of headroom,
     * and the full history already lives in each client's own game log. */
    private const EVENTS_RETAINED = 200;

    // GET /api/games/{code}/version[?after=N]
    // The clients' poll loop -- see routes/api.php. Answers "anything new?"
    // from the single row it already reads, and carries any narration the
    // caller has not seen yet, so a waiting client still makes ONE request per
    // tick. Stays tiny when nothing has happened.
    public function version(Request $req, string $code)
    {
        $game = $this->slot($code)->game;
        $after = max(0, (int) $req->query('after', 0));

        $body = [
            'version' => $game->version,
            'status' => $game->status,
            'lastEvent' => $game->last_event_seq,
        ];

        if ($after < $game->last_event_seq) {
            $rows = GameEvent::where('game_id', $game->id)
                ->where('seq', '>', $after)
                ->orderBy('seq')
                ->limit(self::EVENTS_PER_POLL)
                ->get(['seq', 'seat', 'kind', 'level', 'message', 'version']);

            $body['events'] = $rows;
            // Lets a client that has fallen behind retention skip ahead
            // instead of waiting for rows that no longer exist.
            $body['oldestEvent'] = (int) GameEvent::where('game_id', $game->id)->min('seq');
        }

        return response()->json($body);
    }

    // POST /api/games/{code}/events  { events: [{kind, level, message}, ...] }
    // Appends narration from the player currently taking their turn.
    public function appendEvents(Request $req, string $code)
    {
        $data = $req->validate([
            'events' => 'required|array|max:20',
            'events.*.kind' => 'required|string|in:toast,banner',
            'events.*.level' => 'required|string|max:8',
            'events.*.message' => 'required|string|max:1000',
        ]);

        $slot = $this->slot($code);

        return DB::transaction(function () use ($data, $slot) {
            // Same lock the state PUT takes, so concurrent writers cannot mint
            // the same seq -- this is why seq is safe to use as a cursor where
            // the auto-increment id would not be.
            $game = Game::whereKey($slot->game_id)->lockForUpdate()->first();

            $seq = $game->last_event_seq;
            $now = now();
            $rows = [];
            foreach ($data['events'] as $e) {
                $rows[] = [
                    'game_id' => $game->id,
                    'seq' => ++$seq,
                    'seat' => $slot->player_index,
                    'kind' => $e['kind'],
                    'level' => $e['level'],
                    'message' => $e['message'],
                    'version' => $game->version,
                    'created_at' => $now,
                ];
            }

            GameEvent::insert($rows);
            $game->update(['last_event_seq' => $seq]);

            // Probabilistic: a DELETE on every append would be write
            // amplification for nothing.
            if (intdiv($seq, 64) !== intdiv($seq - count($rows), 64)) {
                GameEvent::where('game_id', $game->id)
                    ->where('seq', '<=', $seq - self::EVENTS_RETAINED)
                    ->delete();
            }

            return response()->json(['lastEvent' => $seq]);
        });
    }

    // POST /api/games  { state: "<json string>" }
    // Creates the shared game plus one join code per player slot.
    public function store(Request $req)
    {
        $data = $req->validate(['state' => 'required|string|max:' . self::MAX_STATE_BYTES]);

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
            // Seeds the joiner's cursor at "now", so they don't replay a
            // backlog of narration from before they arrived.
            'lastEvent' => $game->last_event_seq,
        ]);
    }

    // PUT /api/games/{code}/state  { state, version }
    public function update(Request $req, string $code)
    {
        $data = $req->validate([
            'state' => 'required|string|max:' . self::MAX_STATE_BYTES,
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
