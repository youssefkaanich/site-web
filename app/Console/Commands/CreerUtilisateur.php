<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreerUtilisateur extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:creer-utilisateur';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Crée (ou met à jour) un compte pour se connecter au site sopal-web';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $nom = $this->ask('Nom complet');
        $email = $this->ask('Email');

        $validation = Validator::make(['nom' => $nom, 'email' => $email], [
            'nom' => 'required|string|max:255',
            'email' => 'required|email',
        ]);

        if ($validation->fails()) {
            foreach ($validation->errors()->all() as $erreur) {
                $this->error($erreur);
            }

            return self::FAILURE;
        }

        $existant = User::where('email', $email)->first();
        if ($existant && !$this->confirm("Un compte existe déjà pour {$email}. Changer son mot de passe ?")) {
            return self::SUCCESS;
        }

        $motDePasse = $this->secret('Mot de passe (rien ne s\'affiche à l\'écran)');
        $confirmation = $this->secret('Confirme le mot de passe');

        if ($motDePasse !== $confirmation) {
            $this->error('Les deux mots de passe ne correspondent pas.');

            return self::FAILURE;
        }

        if (strlen($motDePasse) < 8) {
            $this->error('Le mot de passe doit faire au moins 8 caractères.');

            return self::FAILURE;
        }

        User::updateOrCreate(
            ['email' => $email],
            ['name' => $nom, 'password' => Hash::make($motDePasse)]
        );

        $this->info("Compte prêt : {$email}");

        return self::SUCCESS;
    }
}
