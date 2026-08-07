<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Table `commandes` : une ligne = un article demandé dans un mail.
 *
 * Cette table existait depuis le début du projet mais avait été créée
 * DIRECTEMENT par le script Python, sans migration. Sur une installation
 * neuve, `php artisan migrate` ne la créait donc pas et le site tombait en
 * erreur dès la première page. Migration écrite le 07/08/2026 à partir de la
 * structure réelle de la base, pour qu'une installation depuis zéro
 * fonctionne.
 *
 * Datée du 01/01/2026 pour s'exécuter AVANT les migrations qui en dépendent.
 *
 * Les quantités sont en `string` et non en nombre : les mails contiennent des
 * valeurs comme « 2 palettes », « environ 500 » ou une cellule vide. Convertir
 * à l'insertion ferait perdre l'information d'origine ; la conversion se fait
 * plus tard, uniquement quand un calcul l'exige.
 */
return new class extends Migration
{
    private const CONNEXION = 'mysql';

    public function up(): void
    {
        if (Schema::connection(self::CONNEXION)->hasTable('commandes')) {
            return; // déjà créée à la main sur les installations existantes
        }

        Schema::connection(self::CONNEXION)->create('commandes', function (Blueprint $table) {
            $table->increments('id');

            // Identifiant unique du mail : évite de réinsérer deux fois la
            // même commande à chaque passage du script.
            $table->string('Message_ID')->nullable();
            $table->string('Date_mail', 100)->nullable();
            $table->string('Emetteur')->nullable();
            $table->string('Job', 50)->nullable();          // Export | Commercial
            $table->string('Objet')->nullable();            // objet du mail, nettoyé
            $table->string('Source', 50)->nullable();        // tableau-html | texte-libre | image-ocr

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
            $table->string('Image_Path')->nullable();

            // Corps du mail : sert à détecter le mot « chantier ».
            $table->text('Texte_Mail')->nullable();

            // en_attente | partiellement_servie | servie
            $table->string('statut', 30)->default('en_attente');

            // Corbeille : suppression réversible (SoftDeletes).
            $table->timestamp('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection(self::CONNEXION)->dropIfExists('commandes');
    }
};
