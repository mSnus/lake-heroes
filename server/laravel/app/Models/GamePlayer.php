<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GamePlayer extends Model
{
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['code', 'game_id', 'player_index', 'color', 'name'];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
