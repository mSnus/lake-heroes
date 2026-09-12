<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    protected $fillable = ['state', 'version', 'status', 'last_event_seq'];

    public function players(): HasMany
    {
        return $this->hasMany(GamePlayer::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(GameEvent::class);
    }
}
