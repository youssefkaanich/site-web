<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Compte des mouvements écartés pour cause de statut Q (qualité/quarantaine)
 * ou R* (rebut, retours) : affiché à l'import pour que l'utilisateur voie ce
 * qui a été retiré, plutôt que de constater un écart inexpliqué.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('mysql')->table('mouvements_imports', function (Blueprint $table) {
            $table->unsignedInteger('ecartes_statut')->default(0)->after('ecartes_quantite');
        });
    }

    public function down(): void
    {
        Schema::connection('mysql')->table('mouvements_imports', function (Blueprint $table) {
            $table->dropColumn('ecartes_statut');
        });
    }
};
