<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Protège ce PC (où la table existe déjà, créée par le script Python) :
        // sur un nouveau PC, la table n'existe pas encore et sera créée normalement.
        if (Schema::hasTable('commandes')) {
            return;
        }

        Schema::create('commandes', function (Blueprint $table) {
            $table->id();
            $table->string('Message_ID')->nullable();
            $table->string('Date_mail', 100)->nullable();
            $table->string('Source', 50)->nullable();
            $table->string('Article', 100)->nullable();
            $table->string('Designation')->nullable();
            $table->string('Qte_demandee', 50)->nullable();
            $table->string('Reste_a_livrer', 50)->nullable();
            $table->string('Qte_en_rupture', 50)->nullable();
            $table->string('Qte_allouee', 50)->nullable();
            $table->string('Qte_a_allouer', 50)->nullable();
            $table->string('Site_exp', 50)->nullable();
            $table->string('UV', 20)->nullable();
            $table->string('Destination')->nullable();
            $table->string('Echeance', 100)->nullable();
            $table->date('Echeance_date')->nullable();
            $table->string('Urgent', 50)->nullable();
            $table->text('Note')->nullable();
            $table->string('Extraction', 50)->nullable();
            $table->string('statut', 50)->default('nouvelle');
            $table->string('Image_Path')->nullable();
            $table->text('Texte_Mail')->nullable();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('commandes');
    }
};
