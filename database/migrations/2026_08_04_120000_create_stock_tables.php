<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Imports de stock (fichier INVLISTELOCALL de l'ERP), rangés en base plutôt
 * qu'en fichiers JSON dans storage/.
 *
 * Pourquoi ce changement : `quantitesParArticle()` — appelée par la page
 * Analyse, le service des commandes et tout le calcul de stock historique —
 * devait ouvrir et décoder un JSON de plusieurs mégaoctets à chaque appel pour
 * n'en additionner qu'une colonne. En base, c'est un GROUP BY indexé.
 *
 * Les colonnes utiles au métier (Article, Quantité, Emplacement, Statut) sont
 * de vraies colonnes indexables ; la ligne complète reste stockée en JSON dans
 * `donnees`, ce qui permet au tableau de la page Stock / Production de
 * continuer à afficher n'importe quelle colonne du fichier d'origine.
 */
return new class extends Migration
{
    private const CONNEXION = 'mysql';

    public function up(): void
    {
        Schema::connection(self::CONNEXION)->create('stock_imports', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('nom_fichier');

            // Ligne d'en-tête du fichier, ex : "INV emplacement tous 2026-07-23 00:00:00 08:06:56"
            $table->string('titre_stock')->nullable();

            // Date/heure de l'inventaire, extraite du titre à l'import : c'est
            // la borne de départ du calcul de stock historique. La stocker
            // évite de refaire l'analyse du titre à chaque page.
            $table->dateTime('instant_reference')->nullable();

            // Définition des colonnes du fichier (clé, libellé, numérique),
            // pour réafficher le tableau tel qu'il était.
            $table->json('colonnes');

            $table->unsignedInteger('lignes_lues')->default(0);
            $table->unsignedInteger('lignes_gardees')->default(0);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::connection(self::CONNEXION)->create('stock_lignes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('import_id', 64);

            // Un même article occupe plusieurs emplacements : plusieurs lignes
            // par article, additionnées au moment du calcul.
            $table->string('Article', 100);
            $table->string('Designation')->nullable();
            $table->decimal('Quantite', 14, 3)->default(0);
            $table->string('Emplacement', 60)->nullable();
            $table->string('Statut', 20)->nullable();

            // Ligne complète du fichier, pour l'affichage générique.
            $table->json('donnees');

            $table->index(['import_id', 'Article'], 'idx_import_article');
            $table->index('Article', 'idx_article');
        });
    }

    public function down(): void
    {
        Schema::connection(self::CONNEXION)->dropIfExists('stock_lignes');
        Schema::connection(self::CONNEXION)->dropIfExists('stock_imports');
    }
};
