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

    /** Matches the client's MAX_PLAYERS. */
    private const MAX_PLAYERS = 6;

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
            'events.*.level' => 'required|string|in:default,info,success,warning,error,debug',
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

        $parsed = $this->checkedState($data['state']);

        return DB::transaction(function () use ($data, $parsed) {
            $game = Game::create([
                'state' => $data['state'],
                'version' => 1,
                'status' => 'active',
            ]);

            $codes = [];
            foreach (array_values($parsed['players']) as $i => $p) {
                $code = $this->uniqueCode();
                $color = $p['color'] ?? '';
                $name = $p['name'] ?? "Player $i";
                GamePlayer::create([
                    'code' => $code,
                    'game_id' => $game->id,
                    'player_index' => $i,
                    'color' => $color,
                    'name' => $name,
                ]);
                $codes[] = ['code' => $code, 'playerIndex' => $i, 'color' => $color, 'name' => $name];
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

        $parsed = $this->checkedState($data['state']);

        return DB::transaction(function () use ($data, $code, $parsed) {
            $slot = $this->slot($code);
            $game = Game::whereKey($slot->game_id)->lockForUpdate()->first();

            // The seats are fixed when the game is created.
            abort_unless(count($parsed['players']) === $game->players()->count(), 422, 'player count changed');

            // Optimistic concurrency: reject stale writes so two clients can't clobber.
            if ((int) $data['version'] !== (int) $game->version) {
                return response()->json(['error' => 'stale', 'version' => $game->version], 409);
            }

            $game->update([
                'state' => $data['state'],
                'version' => $game->version + 1,
                'status' => !empty($parsed['gameOver']) ? 'finished' : 'active',
            ]);

            return response()->json(['version' => $game->version]);
        });
    }

    /**
     * The state is stored and relayed to every other player's browser, which
     * renders names and colours into HTML -- so they are held to a strict shape.
     */
    private function checkedState(string $state): array
    {
        $parsed = json_decode($state, true);
        abort_unless(is_array($parsed), 422, 'state is not a JSON object');

        $players = $parsed['players'] ?? null;
        abort_unless(
            is_array($players) && count($players) > 0 && count($players) <= self::MAX_PLAYERS,
            422,
            'state.players missing or out of range'
        );

        foreach ($players as $p) {
            abort_unless(is_array($p), 422, 'invalid player');
            $name = $p['name'] ?? '';
            abort_unless(
                is_string($name) && mb_strlen($name) <= 48 && !preg_match('/[<>]/', $name),
                422,
                'invalid player name'
            );
            foreach (['color', 'lightColor'] as $key) {
                $value = $p[$key] ?? '';
                abort_unless(
                    is_string($value) && ($value === '' || preg_match('/^(#[0-9a-fA-F]{3,8}|[a-z]{3,20})$/', $value)),
                    422,
                    "invalid player $key"
                );
            }

            $image = $p['image'] ?? '';
            abort_unless(is_string($image) && preg_match('/^[a-z]{0,16}$/', $image), 422, 'invalid player image');
        }

        foreach (['gameMessage', 'kingRewardMessage'] as $key) {
            $value = $parsed[$key] ?? '';
            abort_unless(is_string($value) && !preg_match('/[<>]/', $value), 422, "invalid $key");
        }

        return $parsed;
    }

    private function slot(string $code): GamePlayer
    {
        return GamePlayer::with('game')->find(strtoupper($code)) ?? abort(404, 'Game not found');
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
