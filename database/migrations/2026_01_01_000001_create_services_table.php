<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Table `services` : historique des sorties de stock.
 *
 * Chaque ligne enregistre qu'une quantité a été servie pour une commande.
 * Comme `commandes`, cette table avait été créée à la main : sans migration,
 * une installation neuve n'avait pas de page « Analyse » fonctionnelle.
 * Écrite le 07/08/2026 d'après la structure réelle.
 *
 * PRINCIPE IMPORTANT : le fichier Excel de stock n'est JAMAIS modifié.
 *
 *     stock affiché = quantité du fichier − somme des services
 *
 * Annuler un service revient donc à supprimer sa ligne : le stock remonte
 * de lui-même, sans qu'aucune donnée source ne soit touchée.
 *
 * Pas de colonne `updated_at` : un service n'est jamais modifié. Il est créé,
 * ou annulé — donc supprimé. Cette contrainte volontaire garantit que
 * l'historique reste fidèle.
 */
return new class extends Migration
{
    private const CONNEXION = 'mysql';

    public function up(): void
    {
        if (Schema::connection(self::CONNEXION)->hasTable('services')) {
            return; // déjà créée à la main sur les installations existantes
        }

        Schema::connection(self::CONNEXION)->create('services', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('commande_id');

            $table->string('Article', 100)->nullable();
            $table->decimal('quantite', 12, 2);

            // Instantané de stock concerné. Un nouvel import repart à zéro :
            // un export ERP contient déjà les sorties physiques, les déduire
            // une seconde fois les compterait deux fois.
            $table->string('import_id', 64)->nullable();

            $table->string('servi_par')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('commande_id', 'idx_commande');
            $table->index(['Article', 'import_id'], 'idx_article_import');
        });
    }

    public function down(): void
    {
        Schema::connection(self::CONNEXION)->dropIfExists('services');
    }
};
