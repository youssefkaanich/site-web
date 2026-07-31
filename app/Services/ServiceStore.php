<?php

namespace App\Services;

use App\Http\Controllers\StockController;
use App\Models\Commande;
use App\Models\Service;
use Illuminate\Support\Facades\DB;

/**
 * Service des commandes depuis le stock : enregistrement d'une sortie,
 * annulation, et calcul du stock réellement disponible.
 *
 * Principe : le fichier Excel de stock n'est JAMAIS modifié. Le stock
 * disponible est recalculé à la volée = quantité du fichier − somme des
 * services enregistrés pour cet article. Le stock est donc partagé entre
 * commandes : servir l'une diminue aussitôt le disponible affiché pour les
 * autres commandes du même article.
 *
 * Les services sont rattachés à l'import de stock actif (import_id). Au
 * prochain import, seuls les services du NOUVEL import sont déduits : un
 * export ERP est un instantané réel du magasin, il contient déjà les sorties
 * physiques, les déduire à nouveau les compterait deux fois. L'historique
 * reste consultable, il cesse simplement d'agir sur le stock.
 */
class ServiceStore
{
    public const EN_ATTENTE = 'en_attente';
    public const PARTIELLE = 'partiellement_servie';
    public const SERVIE = 'servie';

    /** Quantités déjà servies par article, pour l'import de stock actif uniquement. */
    public static function servisParArticle(?string $importId): array
    {
        if ($importId === null) {
            return [];
        }

        return Service::where('import_id', $importId)
            ->selectRaw('Article, SUM(quantite) AS total')
            ->groupBy('Article')
            ->pluck('total', 'Article')
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    /** Total déjà servi pour une commande donnée (tous imports confondus : c'est l'avancement de la commande). */
    public static function servisParCommande(array $commandeIds): array
    {
        if (empty($commandeIds)) {
            return [];
        }

        return Service::whereIn('commande_id', $commandeIds)
            ->selectRaw('commande_id, SUM(quantite) AS total')
            ->groupBy('commande_id')
            ->pluck('total', 'commande_id')
            ->map(fn ($v) => (float) $v)
            ->all();
    }

    /** Historique complet d'une liste de commandes, du plus récent au plus ancien. */
    public static function historique(array $commandeIds): array
    {
        if (empty($commandeIds)) {
            return [];
        }

        return Service::whereIn('commande_id', $commandeIds)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->groupBy('commande_id')
            ->map(fn ($lignes) => $lignes->map(fn (Service $s) => [
                'id' => $s->id,
                'quantite' => $s->quantite,
                'servi_par' => $s->servi_par,
                'date' => $s->created_at?->toIso8601String(),
            ])->all())
            ->all();
    }

    /**
     * Enregistre une sortie de stock pour une commande.
     *
     * @throws \RuntimeException si la quantité dépasse le stock disponible ou
     *                           le reste à livrer (message destiné à l'utilisateur).
     */
    public static function servir(int $commandeId, float $quantite, ?string $utilisateur = null): void
    {
        if ($quantite <= 0) {
            throw new \RuntimeException('La quantité servie doit être supérieure à 0.');
        }

        $commande = Commande::find($commandeId);
        if (!$commande) {
            throw new \RuntimeException("Cette commande n'existe plus.");
        }

        $stock = StockController::quantitesParArticle();
        $article = trim((string) $commande->Article);

        // Transaction : deux services simultanés sur le même article ne
        // doivent pas pouvoir passer tous les deux le contrôle de stock.
        DB::connection('mysql')->transaction(function () use ($commande, $commandeId, $quantite, $utilisateur, $stock, $article) {
            $disponible = self::stockDisponible($article, $stock);
            if ($quantite > $disponible) {
                throw new \RuntimeException(
                    'Stock insuffisant : '.self::nombre($disponible).' disponible(s) pour l\'article '
                    .($article ?: '(sans article)').', or vous demandez d\'en servir '.self::nombre($quantite).'.'
                );
            }

            $restant = self::resteALivrer($commande);
            if ($restant !== null && $quantite > $restant) {
                throw new \RuntimeException(
                    'Il ne reste que '.self::nombre($restant).' à livrer sur cette commande, '
                    .'vous ne pouvez pas en servir '.self::nombre($quantite).'.'
                );
            }

            Service::create([
                'commande_id' => $commandeId,
                'Article' => $article ?: null,
                'quantite' => $quantite,
                'import_id' => $stock['id'] ?? null,
                'servi_par' => $utilisateur,
            ]);

            self::rafraichirStatut($commande);
        });
    }

    /** Annule un service : la ligne est supprimée, donc le stock remonte automatiquement. */
    public static function annuler(int $serviceId): void
    {
        $service = Service::find($serviceId);
        if (!$service) {
            throw new \RuntimeException("Ce service n'existe plus.");
        }

        $commande = Commande::find($service->commande_id);
        $service->delete();

        if ($commande) {
            self::rafraichirStatut($commande);
        }
    }

    /** Marque une commande servie à la main (cas des commandes sans quantité demandée). */
    public static function marquerServie(int $commandeId): void
    {
        Commande::where('id', $commandeId)->update(['statut' => self::SERVIE]);
    }

    /** Remet une commande servie dans la vue active (sans toucher à son historique de services). */
    public static function reactiver(int $commandeId): void
    {
        $commande = Commande::find($commandeId);
        if (!$commande) {
            return;
        }

        $servi = self::servisParCommande([$commandeId])[$commandeId] ?? 0.0;
        $commande->update(['statut' => $servi > 0 ? self::PARTIELLE : self::EN_ATTENTE]);
    }

    /** Stock réellement disponible pour un article : fichier Excel − services de l'import actif. */
    public static function stockDisponible(string $article, ?array $stock = null): float
    {
        $stock ??= StockController::quantitesParArticle();
        $servis = self::servisParArticle($stock['id'] ?? null);

        return (float) ($stock['quantites'][$article] ?? 0) - (float) ($servis[$article] ?? 0);
    }

    /**
     * Quantité à servir au total pour une commande : Qte_demandee, et à
     * défaut Reste_a_livrer (souvent la seule renseignée sur les commandes
     * extraites d'un mail : 24 commandes sur 170 ont Qte_demandee, 62 ont
     * Reste_a_livrer). null si aucune des deux n'est exploitable : dans ce
     * cas aucun plafond n'est appliqué et la commande ne peut être archivée
     * que via "Marquer comme servie".
     */
    public static function quantiteAServir(Commande $commande): ?float
    {
        return self::nombreOuNull($commande->Qte_demandee)
            ?? self::nombreOuNull($commande->Reste_a_livrer);
    }

    /** Reste à livrer = quantité à servir − total déjà servi. null si la quantité est inconnue. */
    public static function resteALivrer(Commande $commande): ?float
    {
        $aServir = self::quantiteAServir($commande);
        if ($aServir === null) {
            return null;
        }

        $servi = self::servisParCommande([$commande->id])[$commande->id] ?? 0.0;

        return max(0.0, $aServir - $servi);
    }

    /** Recalcule le statut d'après le total servi (en attente / partiellement servie / servie). */
    private static function rafraichirStatut(Commande $commande): void
    {
        $servi = self::servisParCommande([$commande->id])[$commande->id] ?? 0.0;
        $aServir = self::quantiteAServir($commande);

        $statut = match (true) {
            $servi <= 0 => self::EN_ATTENTE,
            $aServir !== null && $servi >= $aServir => self::SERVIE,
            default => self::PARTIELLE,
        };

        $commande->update(['statut' => $statut]);
    }

    /** Les quantités sont stockées en varchar : conversion tolérante (virgule décimale, espaces). */
    public static function nombreOuNull($valeur): ?float
    {
        $texte = trim(str_replace([' ', ','], ['', '.'], (string) $valeur));

        return $texte === '' || !is_numeric($texte) ? null : (float) $texte;
    }

    /** Affiche un nombre sans décimales inutiles (12.00 -> 12, 12.50 -> 12.5). */
    private static function nombre(float $v): string
    {
        return rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.');
    }
}
