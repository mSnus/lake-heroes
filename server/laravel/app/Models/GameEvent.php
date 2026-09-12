<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameEvent extends Model
{
    /** Rows are append-only and never edited, so only a creation stamp. */
    public const UPDATED_AT = null;

    protected $fillable = ['game_id', 'seq', 'seat', 'kind', 'level', 'message', 'version'];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
