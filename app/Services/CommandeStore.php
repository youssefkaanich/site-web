<?php

namespace App\Services;

use App\Models\Commande;
use Illuminate\Support\Facades\DB;

/**
 * Accès aux commandes, stockées dans la table MySQL `commandes` (base
 * "sopal", XAMPP) via le modèle Eloquent Commande — remplace l'ancienne
 * version Firestore (abandonnée : le quota gratuit Google était trop vite
 * dépassé avec le rafraîchissement automatique de la page Gestion).
 *
 * Garde volontairement la même API statique que l'ancienne version
 * Firestore (toutes(), creer(), mettreAJour()...) pour que
 * CommandeController.php n'ait presque rien à changer.
 */
class CommandeStore
{
    private const CONNEXION = 'mysql';

    /** Fichier de suivi des mails déjà traités par les scripts Python (voir extract_gmail_commandes.py). */
    private const FICHIER_TRAITES = 'C:\\STAGE\\projet sopal\\traites_ids.txt';

    // ---------- Lecture ----------

    /** @return array<int, array> Commandes non supprimées, l'id le plus grand (la plus récente) en premier. */
    public static function toutes(): array
    {
        return Commande::orderByDesc('id')->get()->toArray();
    }

    /** @return array<int, array> Commandes envoyées à la corbeille, les plus récemment supprimées d'abord. */
    public static function corbeille(): array
    {
        return Commande::onlyTrashed()
            ->orderByDesc('deleted_at')
            ->orderByDesc('id')
            ->get()
            ->toArray();
    }

    public static function trouver(string $id): ?array
    {
        $commande = Commande::withTrashed()->find($id);

        return $commande?->toArray();
    }

    // ---------- Écriture ----------

    public static function creer(array $data): string
    {
        return (string) Commande::create($data)->id;
    }

    public static function mettreAJour(string $id, array $data): void
    {
        Commande::withTrashed()->where('id', $id)->update($data);
    }

    public static function supprimerDefinitivement(string $id): void
    {
        $messageId = Commande::withTrashed()->where('id', $id)->value('Message_ID');

        Commande::withTrashed()->where('id', $id)->forceDelete();
        self::renumeroterIds();
        self::oublierMessageIds([$messageId]);
    }

    public static function envoyerCorbeille(string $id): void
    {
        Commande::where('id', $id)->delete();
    }

    public static function restaurer(string $id): void
    {
        Commande::onlyTrashed()->where('id', $id)->restore();
    }

    /** @param string[] $ids */
    public static function supprimerDefinitivementPlusieurs(array $ids): void
    {
        $messageIds = Commande::withTrashed()->whereIn('id', $ids)->pluck('Message_ID')->all();

        Commande::withTrashed()->whereIn('id', $ids)->forceDelete();
        self::renumeroterIds();
        self::oublierMessageIds($messageIds);
    }

    /** @param string[] $ids */
    public static function restaurerPlusieurs(array $ids): void
    {
        Commande::onlyTrashed()->whereIn('id', $ids)->restore();
    }

    /** @param string[] $ids */
    public static function envoyerCorbeillePlusieurs(array $ids): void
    {
        Commande::whereIn('id', $ids)->delete();
    }

    /**
     * Retire ces Message_ID du fichier traites_ids.txt (voir
     * extract_gmail_commandes.py::charger_ids_traites/marquer_traite) :
     * ce fichier empêche normalement de retraiter deux fois le même mail,
     * mais après une suppression DÉFINITIVE volontaire, on veut au
     * contraire que le mail redevienne "non traité" pour que la prochaine
     * extraction Gmail/Outlook le reconstruise automatiquement.
     *
     * @param array<int, string|null> $messageIds
     */
    private static function oublierMessageIds(array $messageIds): void
    {
        $messageIds = array_filter(array_unique($messageIds));

        if (empty($messageIds) || !file_exists(self::FICHIER_TRAITES)) {
            return;
        }

        $lignes = file(self::FICHIER_TRAITES, FILE_IGNORE_NEW_LINES) ?: [];
        $restantes = array_filter($lignes, fn ($ligne) => !in_array(trim($ligne), $messageIds, true));

        if (count($restantes) !== count($lignes)) {
            file_put_contents(self::FICHIER_TRAITES, implode(PHP_EOL, $restantes).(empty($restantes) ? '' : PHP_EOL));
        }
    }

    /** Renumérote les id de 1 à N (dans l'ordre chronologique existant), pour qu'il n'y ait jamais de trou après une suppression définitive. */
    private static function renumeroterIds(): void
    {
        $connexion = DB::connection(self::CONNEXION);
        $connexion->statement('SET @n := 0');
        $connexion->statement('UPDATE commandes SET id = (@n := @n + 1) ORDER BY id ASC');
        $connexion->statement('ALTER TABLE commandes AUTO_INCREMENT = 1');
    }

    /**
     * Supprime les doublons exacts (même mail, article, désignation, quantité,
     * source) directement en base, en gardant la plus ancienne occurrence
     * (id le plus petit). $commandes n'est pas utilisé (gardé pour la
     * compatibilité d'appel avec CommandeController) : on relit toujours
     * depuis la base après le nettoyage.
     */
    public static function nettoyerDoublons(array $commandes): array
    {
        DB::connection(self::CONNEXION)->delete('
            DELETE c1 FROM commandes c1
            INNER JOIN commandes c2
            ON c1.Message_ID <=> c2.Message_ID
            AND c1.Article <=> c2.Article
            AND c1.Designation <=> c2.Designation
            AND c1.Qte_demandee <=> c2.Qte_demandee
            AND c1.Source <=> c2.Source
            AND c1.id > c2.id
            WHERE c1.deleted_at IS NULL AND c2.deleted_at IS NULL
        ');

        return self::toutes();
    }
}
