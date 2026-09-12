<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Narration streamed during a turn, so the other players see what the active
 * player is doing while they do it rather than only in the state handed over
 * at the end.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('game_id')->constrained()->cascadeOnDelete();
            // Per-GAME cursor, not the auto-increment id: InnoDB assigns ids at
            // INSERT but rows only become visible at COMMIT, so ids can appear
            // out of order and a reader at ?after=N could skip one for good.
            // This is assigned under the same row lock the state PUT takes.
            $t->unsignedInteger('seq');
            $t->unsignedTinyInteger('seat');
            // varchar, not enum: extending a MySQL enum needs an ALTER TABLE,
            // and more kinds than toast/banner are likely.
            $t->string('kind', 16);
            $t->string('level', 8);
            $t->text('message');
            // games.version when this was written, so a straggler can be
            // dropped once the state it described has been superseded.
            $t->unsignedInteger('version');
            $t->timestamp('created_at')->nullable();

            // The only query shape: "this game's rows after N, in order".
            $t->unique(['game_id', 'seq']);
        });

        // Denormalized so the hot /version poll can answer "anything new?"
        // from the row it already reads, with no extra query.
        Schema::table('games', function (Blueprint $t) {
            $t->unsignedInteger('last_event_seq')->default(0)->after('version');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $t) {
            $t->dropColumn('last_event_seq');
        });
        Schema::dropIfExists('game_events');
    }
};
