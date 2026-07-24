<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use Illuminate\Support\Facades\Cache;

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
 * - l'id reste un nombre entier séquentiel (1, 2, 3...), mais généré via un
 *   compteur Firestore (document "_compteurs/commandes") au lieu d'un
 *   AUTO_INCREMENT SQL — Firestore n'a pas d'équivalent natif ;
 * - il n'y a pas de vraie corbeille (soft delete) : on simule ça avec un
 *   champ booléen "supprime" sur le document ;
 * - le tri "plus récent d'abord" se fait sur le champ "cree_le" (rempli à
 *   la création, par ce service ou par le script Python), pas sur l'id ;
 * - le filtrage se fait côté PHP après avoir tout récupéré (pas de requête
 *   Firestore complexe) : largement suffisant vu le volume de cette appli.
 *
 * Pour la rapidité : le jeton d'authentification Google est mis en cache
 * (sinon chaque requête HTTP referait un aller-retour d'authentification
 * avant même de parler à Firestore), et les écritures groupables (nettoyage
 * des doublons, vieillissement des statuts) partent en UN SEUL appel
 * ("commit" avec plusieurs écritures) au lieu d'un appel par ligne.
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

    private static function nomDocument(string $id): string
    {
        return 'projects/'.self::projectId().'/databases/(default)/documents/'.self::COLLECTION.'/'.$id;
    }

    /** Jeton d'accès Google mis en cache (durée de vie ~1h) pour éviter de
     * ré-authentifier auprès de Google à chaque requête du site. */
    private static function jetonAcces(): string
    {
        return Cache::remember('firebase_access_token', 3000, function () {
            $credentials = new ServiceAccountCredentials(self::SCOPE, config('firebase.credentials'));
            $jeton = $credentials->fetchAuthToken();

            return $jeton['access_token'];
        });
    }

    private static function http(): Client
    {
        if (self::$http === null) {
            self::$http = new Client(['headers' => ['Authorization' => 'Bearer '.self::jetonAcces()]]);
        }

        return self::$http;
    }

    /** Si le jeton mis en cache a expiré côté Google, on le régénère une fois et on réessaie. */
    private static function avecReessai(callable $requete)
    {
        try {
            return $requete();
        } catch (ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 401) {
                Cache::forget('firebase_access_token');
                self::$http = null;

                return $requete();
            }
            throw $e;
        }
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
        return self::avecReessai(function () {
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
        });
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
            $reponse = self::avecReessai(fn () => self::http()->get(self::baseUrl().'/'.self::COLLECTION.'/'.$id));
        } catch (ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 404) {
                return null;
            }
            throw $e;
        }

        return self::documentVersTableau(json_decode((string) $reponse->getBody(), true));
    }

    // ---------- Écriture ----------

    /** Numéro entier séquentiel suivant, via un compteur dédié (équivalent de l'AUTO_INCREMENT SQL). */
    private static function prochainId(): int
    {
        $urlCompteur = self::baseUrl().'/_compteurs/commandes';

        $valeur = self::avecReessai(function () use ($urlCompteur) {
            try {
                $reponse = self::http()->get($urlCompteur);
                $donnees = json_decode((string) $reponse->getBody(), true);

                return self::depuisValeurFirestore($donnees['fields']['valeur'] ?? ['integerValue' => '0']);
            } catch (ClientException $e) {
                if ($e->getResponse()->getStatusCode() !== 404) {
                    throw $e;
                }

                return 0;
            }
        });

        $nouvelleValeur = ((int) $valeur) + 1;

        // PATCH sur Firestore crée le document s'il n'existe pas encore (upsert).
        self::avecReessai(fn () => self::http()->patch($urlCompteur.'?updateMask.fieldPaths=valeur', [
            'json' => ['fields' => ['valeur' => self::versValeurFirestore($nouvelleValeur)]],
        ]));

        return $nouvelleValeur;
    }

    public static function creer(array $data): string
    {
        $id = (string) self::prochainId();

        $data['statut'] = $data['statut'] ?? 'nouvelle';
        $data['supprime'] = false;
        $data['supprime_le'] = null;
        $data['cree_le'] = now()->toIso8601String();

        self::avecReessai(fn () => self::http()->patch(self::baseUrl().'/'.self::COLLECTION.'/'.$id, [
            'json' => ['fields' => self::versChampsFirestore($data)],
        ]));

        return $id;
    }

    public static function mettreAJour(string $id, array $data): void
    {
        self::ecrireLots([self::ecritureMiseAJour($id, $data)]);
    }

    public static function supprimerDefinitivement(string $id): void
    {
        self::avecReessai(function () use ($id) {
            try {
                self::http()->delete(self::baseUrl().'/'.self::COLLECTION.'/'.$id);
            } catch (ClientException $e) {
                if ($e->getResponse()->getStatusCode() !== 404) {
                    throw $e;
                }
            }
        });
    }

    public static function envoyerCorbeille(string $id): void
    {
        self::mettreAJour($id, ['supprime' => true, 'supprime_le' => now()->toIso8601String()]);
    }

    public static function restaurer(string $id): void
    {
        self::mettreAJour($id, ['supprime' => false, 'supprime_le' => null]);
    }

    /** @param string[] $ids */
    public static function supprimerDefinitivementPlusieurs(array $ids): void
    {
        self::ecrireLots(array_map(fn ($id) => self::ecritureSuppression($id), $ids));
    }

    /** @param string[] $ids */
    public static function restaurerPlusieurs(array $ids): void
    {
        $data = ['supprime' => false, 'supprime_le' => null];
        self::ecrireLots(array_map(fn ($id) => self::ecritureMiseAJour($id, $data), $ids));
    }

    /** @param string[] $ids */
    public static function envoyerCorbeillePlusieurs(array $ids): void
    {
        $data = ['supprime' => true, 'supprime_le' => now()->toIso8601String()];
        self::ecrireLots(array_map(fn ($id) => self::ecritureMiseAJour($id, $data), $ids));
    }

    // ---------- Écritures groupées (1 seul appel réseau pour plusieurs lignes) ----------

    private static function ecritureMiseAJour(string $id, array $data): array
    {
        return [
            'update' => ['name' => self::nomDocument($id), 'fields' => self::versChampsFirestore($data)],
            'updateMask' => ['fieldPaths' => array_keys($data)],
        ];
    }

    private static function ecritureSuppression(string $id): array
    {
        return ['delete' => self::nomDocument($id)];
    }

    private static function ecrireLots(array $ecritures): void
    {
        if (empty($ecritures)) {
            return;
        }

        self::avecReessai(fn () => self::http()->post(self::baseUrl().':commit', [
            'json' => ['writes' => $ecritures],
        ]));
    }

    /**
     * Supprime les doublons exacts (même mail, article, désignation, quantité,
     * source) dans une liste déjà chargée (voir toutes()), en gardant la plus
     * ancienne occurrence. Toutes les suppressions partent en UN SEUL appel.
     * Retourne la liste nettoyée (sans les doublons retirés).
     */
    public static function nettoyerDoublons(array $commandes): array
    {
        $vus = [];
        $aSupprimer = [];

        // $commandes est trié du plus récent au plus ancien : en le parcourant
        // à l'envers, la première occurrence rencontrée est la plus ancienne.
        foreach (array_reverse($commandes) as $commande) {
            $cle = implode('|', [
                $commande['Message_ID'] ?? '',
                $commande['Article'] ?? '',
                $commande['Designation'] ?? '',
                $commande['Qte_demandee'] ?? '',
                $commande['Source'] ?? '',
            ]);

            if (isset($vus[$cle])) {
                $aSupprimer[$commande['id']] = true;
                continue;
            }

            $vus[$cle] = true;
        }

        if (empty($aSupprimer)) {
            return $commandes;
        }

        self::ecrireLots(array_map(fn ($id) => self::ecritureSuppression($id), array_keys($aSupprimer)));

        return array_values(array_filter($commandes, fn ($c) => !isset($aSupprimer[$c['id']])));
    }

    /**
     * Passe au statut "ancienne" toute commande "nouvelle" dont le mail
     * d'origine (Date_mail) a plus de 2 jours, dans une liste déjà chargée.
     * Toutes les mises à jour partent en UN SEUL appel.
     * Retourne la liste avec les statuts à jour.
     */
    public static function vieillirStatuts(array $commandes): array
    {
        $limite = now()->subDays(2);
        $ecritures = [];

        foreach ($commandes as $i => $commande) {
            if (($commande['statut'] ?? null) !== 'nouvelle' || empty($commande['Date_mail'])) {
                continue;
            }

            try {
                $date = \Carbon\Carbon::parse($commande['Date_mail']);
            } catch (\Exception $e) {
                continue;
            }

            if ($date->lt($limite)) {
                $ecritures[] = self::ecritureMiseAJour($commande['id'], ['statut' => 'ancienne']);
                $commandes[$i]['statut'] = 'ancienne';
            }
        }

        self::ecrireLots($ecritures);

        return $commandes;
    }
}
