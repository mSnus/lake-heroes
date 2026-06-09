<?php

use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;

Route::post('/games', [GameController::class, 'store'])->middleware('throttle:20,1');
Route::get('/games/{code}', [GameController::class, 'show']);
Route::put('/games/{code}/state', [GameController::class, 'update']);
