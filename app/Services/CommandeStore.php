<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;

/**
 * Accès à la collection Firestore "commandes", en remplacement de l'ancien
 * modèle Eloquent Commande (MySQL). Un document Firestore = une commande.
 *
 * Utilise directement l'API REST de Firestore (pas le SDK google/cloud-firestore,
 * qui exige l'extension PHP "grpc" — indisponible sur ce PC Windows/XAMPP).
 * L'authentification se fait via google/auth (dépendance de kreait/firebase-php)
 * avec la clé de service Firebase.
 *
 * Différences avec l'ancien système MySQL :
 * - l'id n'est plus un entier auto-incrémenté mais une chaîne générée par
 *   Firestore (donc plus de "renumérotation" après suppression) ;
 * - il n'y a pas de vraie corbeille (soft delete) : on simule ça avec un
 *   champ booléen "supprime" sur le document ;
 * - le tri "plus récent d'abord" se fait sur le champ "cree_le" (rempli à
 *   la création, par ce service ou par le script Python), pas sur l'id ;
 * - le filtrage/tri se fait côté PHP après avoir tout récupéré (pas de
 *   requête Firestore complexe) : largement suffisant vu le volume de
 *   commandes de cette application.
 */
class CommandeStore
{
    private const COLLECTION = 'commandes';
    private const SCOPE = 'https://www.googleapis.com/auth/datastore';

    private static ?Client $http = null;
    private static ?string $projectId = null;

    private static function projectId(): string
    {
        if (self::$projectId === null) {
            $donnees = json_decode(file_get_contents(config('firebase.credentials')), true);
            self::$projectId = $donnees['project_id'];
        }

        return self::$projectId;
    }

    private static function baseUrl(): string
    {
        return 'https://firestore.googleapis.com/v1/projects/'.self::projectId().'/databases/(default)/documents';
    }

    private static function http(): Client
    {
        if (self::$http === null) {
            $credentials = new ServiceAccountCredentials(self::SCOPE, config('firebase.credentials'));
            $jeton = $credentials->fetchAuthToken();

            self::$http = new Client(['headers' => ['Authorization' => 'Bearer '.$jeton['access_token']]]);
        }

        return self::$http;
    }

    // ---------- Conversion PHP <-> format typé Firestore ----------

    private static function versValeurFirestore(mixed $valeur): array
    {
        if ($valeur === null) {
            return ['nullValue' => null];
        }
        if (is_bool($valeur)) {
            return ['booleanValue' => $valeur];
        }
        if (is_int($valeur)) {
            return ['integerValue' => (string) $valeur];
        }
        if (is_float($valeur)) {
            return ['doubleValue' => $valeur];
        }

        return ['stringValue' => (string) $valeur];
    }

    private static function depuisValeurFirestore(array $valeur): mixed
    {
        return match (true) {
            array_key_exists('nullValue', $valeur) => null,
            array_key_exists('booleanValue', $valeur) => $valeur['booleanValue'],
            array_key_exists('integerValue', $valeur) => (int) $valeur['integerValue'],
            array_key_exists('doubleValue', $valeur) => (float) $valeur['doubleValue'],
            array_key_exists('stringValue', $valeur) => $valeur['stringValue'],
            array_key_exists('timestampValue', $valeur) => $valeur['timestampValue'],
            default => null,
        };
    }

    private static function versChampsFirestore(array $data): array
    {
        $champs = [];
        foreach ($data as $cle => $valeur) {
            $champs[$cle] = self::versValeurFirestore($valeur);
        }

        return $champs;
    }

    private static function documentVersTableau(array $document): array
    {
        $ligne = ['id' => basename($document['name'])];
        foreach ($document['fields'] ?? [] as $cle => $valeur) {
            $ligne[$cle] = self::depuisValeurFirestore($valeur);
        }

        return $ligne;
    }

    // ---------- Lecture ----------

    /** Récupère TOUS les documents de la collection (pagination interne), non transformés. */
    private static function tousLesDocuments(): array
    {
        $documents = [];
        $jeton = null;

        do {
            $reponse = self::http()->get(self::baseUrl().'/'.self::COLLECTION, [
                'query' => array_filter(['pageSize' => 300, 'pageToken' => $jeton]),
            ]);
            $donnees = json_decode((string) $reponse->getBody(), true);

            foreach ($donnees['documents'] ?? [] as $document) {
                $documents[] = self::documentVersTableau($document);
            }

            $jeton = $donnees['nextPageToken'] ?? null;
        } while ($jeton);

        return $documents;
    }

    /** @return array<int, array> Commandes non supprimées, les plus récentes d'abord. */
    public static function toutes(): array
    {
        $lignes = array_values(array_filter(
            self::tousLesDocuments(),
            fn (array $c) => ($c['supprime'] ?? false) === false
        ));

        usort($lignes, fn ($a, $b) => strcmp((string) ($b['cree_le'] ?? ''), (string) ($a['cree_le'] ?? '')));

        return $lignes;
    }

    /** @return array<int, array> Commandes envoyées à la corbeille, les plus récemment supprimées d'abord. */
    public static function corbeille(): array
    {
        $lignes = array_values(array_filter(
            self::tousLesDocuments(),
            fn (array $c) => ($c['supprime'] ?? false) === true
        ));

        usort($lignes, fn ($a, $b) => strcmp((string) ($b['supprime_le'] ?? ''), (string) ($a['supprime_le'] ?? '')));

        return $lignes;
    }

    public static function trouver(string $id): ?array
    {
        try {
            $reponse = self::http()->get(self::baseUrl().'/'.self::COLLECTION.'/'.$id);
        } catch (ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 404) {
                return null;
            }
            throw $e;
        }

        return self::documentVersTableau(json_decode((string) $reponse->getBody(), true));
    }

    // ---------- Écriture ----------

    public static function creer(array $data): string
    {
        $data['statut'] = $data['statut'] ?? 'nouvelle';
        $data['supprime'] = false;
        $data['supprime_le'] = null;
        $data['cree_le'] = now()->toIso8601String();

        $reponse = self::http()->post(self::baseUrl().'/'.self::COLLECTION, [
            'json' => ['fields' => self::versChampsFirestore($data)],
        ]);
        $donnees = json_decode((string) $reponse->getBody(), true);

        return basename($donnees['name']);
    }

    public static function mettreAJour(string $id, array $data): void
    {
        $masque = implode('&', array_map(
            fn ($cle) => 'updateMask.fieldPaths='.urlencode($cle),
            array_keys($data)
        ));

        self::http()->patch(self::baseUrl().'/'.self::COLLECTION.'/'.$id.'?'.$masque, [
            'json' => ['fields' => self::versChampsFirestore($data)],
        ]);
    }

    public static function supprimerDefinitivement(string $id): void
    {
        try {
            self::http()->delete(self::baseUrl().'/'.self::COLLECTION.'/'.$id);
        } catch (ClientException $e) {
            if ($e->getResponse()->getStatusCode() !== 404) {
                throw $e;
            }
        }
    }

    public static function envoyerCorbeille(string $id): void
    {
        self::mettreAJour($id, ['supprime' => true, 'supprime_le' => now()->toIso8601String()]);
    }

    public static function restaurer(string $id): void
    {
        self::mettreAJour($id, ['supprime' => false, 'supprime_le' => null]);
    }

    /**
     * Supprime les doublons exacts (même mail, article, désignation, quantité,
     * source), en gardant la plus ancienne occurrence. Retourne le nombre supprimé.
     */
    public static function supprimerDoublons(): int
    {
        $vus = [];
        $supprimes = 0;

        // toutes() est triée du plus récent au plus ancien : en la parcourant
        // à l'envers, la première occurrence rencontrée est la plus ancienne.
        foreach (array_reverse(self::toutes()) as $commande) {
            $cle = implode('|', [
                $commande['Message_ID'] ?? '',
                $commande['Article'] ?? '',
                $commande['Designation'] ?? '',
                $commande['Qte_demandee'] ?? '',
                $commande['Source'] ?? '',
            ]);

            if (isset($vus[$cle])) {
                self::supprimerDefinitivement($commande['id']);
                $supprimes++;
                continue;
            }

            $vus[$cle] = true;
        }

        return $supprimes;
    }
}
