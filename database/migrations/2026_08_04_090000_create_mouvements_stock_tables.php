<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mouvements de stock (fichier Excel MVTSTOTRSVCR de l'ERP), rangés en base
 * plutôt qu'en fichiers JSON : la fiche d'un article a besoin d'interroger ses
 * seuls mouvements, ce qu'une requête indexée fait sans charger les 84 000
 * lignes de l'import.
 *
 * Connexion "mysql" (base sopal_commandes), comme les commandes et les
 * services — pas la connexion sqlite par défaut du site.
 */
return new class extends Migration
{
    private const CONNEXION = 'mysql';

    public function up(): void
    {
        Schema::connection(self::CONNEXION)->create('mouvements_imports', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('nom_fichier');
            $table->string('titre')->nullable();
            $table->unsignedInteger('lignes_lues')->default(0);
            $table->unsignedInteger('mouvements')->default(0);
            $table->unsignedInteger('articles')->default(0);

            // Comptés séparément pour pouvoir expliquer à l'écran POURQUOI des
            // lignes ont été écartées.
            $table->unsignedInteger('ecartes_article')->default(0);
            $table->unsignedInteger('ecartes_date')->default(0);
            $table->unsignedInteger('ecartes_quantite')->default(0);

            $table->dateTime('debut')->nullable();
            $table->dateTime('fin')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::connection(self::CONNEXION)->create('mouvements_stock', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('import_id', 64);

            $table->string('Article', 100);
            $table->string('Designation')->nullable();

            // Date imputation + heure création, réunies en un seul instant :
            // c'est sur lui que se fait le filtrage par rapport à la photo de stock.
            $table->dateTime('instant');

            // Déjà signée dans le fichier ERP : négatif = sortie, positif =
            // entrée. On l'additionne telle quelle, quelle que soit la
            // transaction.
            $table->decimal('quantite', 14, 3);

            $table->string('Transaction', 100)->nullable();
            $table->string('Piece_origine', 120)->nullable();
            $table->string('Emplacement', 60)->nullable();

            // Requête la plus fréquente : les mouvements d'un article, triés
            // dans le temps (fiche article et calcul du stock à un instant T).
            $table->index(['Article', 'instant'], 'idx_article_instant');
            $table->index('import_id', 'idx_import');
        });
    }

    public function down(): void
    {
        Schema::connection(self::CONNEXION)->dropIfExists('mouvements_stock');
        Schema::connection(self::CONNEXION)->dropIfExists('mouvements_imports');
    }
};
