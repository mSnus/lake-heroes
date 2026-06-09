<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    protected $fillable = ['state', 'version', 'status'];

    public function players(): HasMany
    {
        return $this->hasMany(GamePlayer::class);
    }
}
