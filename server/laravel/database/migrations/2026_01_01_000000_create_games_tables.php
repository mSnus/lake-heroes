<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('games', function (Blueprint $t) {
            $t->id();
            $t->longText('state');
            $t->unsignedInteger('version')->default(1);
            $t->enum('status', ['active', 'finished'])->default('active');
            $t->timestamps();
        });

        Schema::create('game_players', function (Blueprint $t) {
            $t->char('code', 8)->primary();          // uppercase, unique join code
            $t->foreignId('game_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('player_index');
            $t->string('color', 16);
            $t->string('name', 64);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_players');
        Schema::dropIfExists('games');
    }
};
