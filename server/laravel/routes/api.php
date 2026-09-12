<?php

use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;

Route::post('/games', [GameController::class, 'store'])->middleware('throttle:20,1');

// Polled every few seconds by every client that isn't taking its turn, so it
// answers with the version counter alone -- fetching the whole state on that
// cadence would move ~1MB/min per observer. Clients GET /games/{code} only
// once this number has actually moved.
//
// It also carries any narration the caller hasn't seen (?after=<cursor>), so a
// waiting client still makes ONE request per tick. A second endpoint at this
// cadence would be a problem: Laravel throttles by IP, so several players
// behind one household NAT share this bucket.
Route::get('/games/{code}/version', [GameController::class, 'version'])->middleware('throttle:120,1');

// Narration from the player currently on turn: a handful of small posts per
// turn, coalesced client-side (see src/online/stream.ts).
Route::post('/games/{code}/events', [GameController::class, 'appendEvents'])->middleware('throttle:60,1');

Route::get('/games/{code}', [GameController::class, 'show'])->middleware('throttle:60,1');
Route::put('/games/{code}/state', [GameController::class, 'update'])->middleware('throttle:60,1');
