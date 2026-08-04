<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `instant` porte désormais la date ET l'heure de CRÉATION du mouvement — le
 * seul couple cohérent (voir basemouvements.py). La date d'IMPUTATION, qui est
 * la date comptable, reste utile à afficher : elle est conservée à part.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('mysql')->table('mouvements_stock', function (Blueprint $table) {
            $table->date('date_imputation')->nullable()->after('instant');
        });
    }

    public function down(): void
    {
        Schema::connection('mysql')->table('mouvements_stock', function (Blueprint $table) {
            $table->dropColumn('date_imputation');
        });
    }
};
