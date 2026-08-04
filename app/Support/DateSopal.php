<?php

namespace App\Support;

use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date as DateExcel;

/**
 * Lecture des dates et heures telles qu'elles sortent des exports Excel de
 * l'ERP. Elles arrivent sous des formes très différentes selon la colonne et
 * selon que la cellule est un vrai type "date" ou du texte :
 *
 *   Date imputation : "01/01/2026", parfois "06/01/26", parfois un nombre
 *                     Excel (45658) quand la cellule est typée date
 *   Heure création  : "1502" (= 15h02), "0828" (= 8h28) — collée, sans ":",
 *                     et le zéro de tête saute si la cellule est numérique
 *   Titre du stock  : "INV emplacement 23/07/2026 08:06:56"
 *
 * Regroupé ici pour que le fichier de stock et le fichier de mouvements
 * soient lus avec exactement les mêmes règles.
 */
class DateSopal
{
    /**
     * Met un instant au format attendu par l'interface : "2026-08-03T09:02:00",
     * SANS décalage de fuseau.
     *
     * Les heures de l'ERP sont des heures murales tunisiennes. Sérialisées avec
     * toIso8601String(), elles sortent en "...+00:00" (l'application tourne en
     * UTC) et le navigateur les reconvertit en heure locale : 09:02 s'affichait
     * 10:02. Sans le décalage, JavaScript les interprète comme des heures
     * locales et les réaffiche à l'identique — ce qui est le comportement
     * voulu : on rejoue l'heure notée dans l'ERP, on ne la convertit pas.
     */
    public static function pourAffichage(?\DateTimeInterface $instant): ?string
    {
        return $instant?->format('Y-m-d\TH:i:s');
    }

    /**
     * Convertit une valeur de cellule en date (heure à 00:00).
     * Retourne null si la valeur est vide ou illisible — l'appelant décide
     * quoi faire (ici : ignorer la ligne et la compter).
     */
    public static function parserDate($valeur): ?Carbon
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }

        // Cellule typée "date" dans Excel : la valeur est un nombre de jours
        // depuis le 30/12/1899. PhpSpreadsheet sait déjà le convertir.
        if (is_numeric($valeur) && !is_string($valeur)) {
            try {
                return Carbon::instance(DateExcel::excelToDateTimeObject((float) $valeur))->startOfDay();
            } catch (\Throwable) {
                return null;
            }
        }

        $texte = trim((string) $valeur);

        // Format ERP : JJ/MM/AAAA ou JJ/MM/AA (le séparateur peut être / - ou .)
        if (preg_match('#^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$#', $texte, $m)) {
            [$jour, $mois, $annee] = [(int) $m[1], (int) $m[2], (int) $m[3]];

            // "26" -> 2026. Le seuil 70 est la convention habituelle : au-delà,
            // on bascule dans les années 1900.
            if ($annee < 100) {
                $annee += $annee < 70 ? 2000 : 1900;
            }

            if (!checkdate($mois, $jour, $annee)) {
                return null;
            }

            return Carbon::create($annee, $mois, $jour, 0, 0, 0);
        }

        // Format ISO (AAAA-MM-JJ), au cas où l'export change de configuration.
        if (preg_match('#^(\d{4})-(\d{1,2})-(\d{1,2})#', $texte, $m)) {
            if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                return null;
            }

            return Carbon::create((int) $m[1], (int) $m[2], (int) $m[3], 0, 0, 0);
        }

        return null;
    }

    /**
     * Convertit une valeur de cellule en heure, retournée en SECONDES depuis
     * minuit (0 à 86399). Retourne null si illisible.
     *
     * Formats acceptés :
     *   "1502"     -> 15:02      (format ERP, sans séparateur)
     *   "828"      -> 08:28      (le zéro de tête a sauté : cellule numérique)
     *   "150245"   -> 15:02:45
     *   "15:02:45" -> 15:02:45
     *   0.5        -> 12:00:00   (fraction de journée, format natif Excel)
     */
    public static function parserHeure($valeur): ?int
    {
        if ($valeur === null || $valeur === '') {
            return null;
        }

        $texte = trim((string) $valeur);

        // Heure écrite avec des ":" (ex: dans le titre du fichier de stock).
        if (str_contains($texte, ':')) {
            $bouts = explode(':', $texte);
            $h = (int) ($bouts[0] ?? 0);
            $m = (int) ($bouts[1] ?? 0);
            $s = (int) ($bouts[2] ?? 0);

            return self::secondes($h, $m, $s);
        }

        // Fraction de journée Excel : 0,5 = midi. Uniquement si < 1, sinon
        // "1502" serait pris pour une fraction.
        if (is_numeric($texte) && (float) $texte > 0 && (float) $texte < 1) {
            return (int) round((float) $texte * 86400);
        }

        // Format collé de l'ERP : on ne garde que les chiffres, puis on
        // complète à gauche. "828" est en réalité "0828" -> 08:28.
        $chiffres = preg_replace('/\D/', '', $texte);
        if ($chiffres === '' || $chiffres === null) {
            return null;
        }

        if (strlen($chiffres) <= 4) {
            $chiffres = str_pad($chiffres, 4, '0', STR_PAD_LEFT);

            return self::secondes((int) substr($chiffres, 0, 2), (int) substr($chiffres, 2, 2), 0);
        }

        $chiffres = str_pad($chiffres, 6, '0', STR_PAD_LEFT);

        return self::secondes(
            (int) substr($chiffres, 0, 2),
            (int) substr($chiffres, 2, 2),
            (int) substr($chiffres, 4, 2)
        );
    }

    /**
     * Combine une cellule de date et une cellule d'heure en un instant précis.
     * Si l'heure est absente ou illisible, la date seule est renvoyée (minuit) :
     * mieux vaut un mouvement daté au jour près qu'un mouvement perdu.
     */
    public static function parserDateHeure($valeurDate, $valeurHeure): ?Carbon
    {
        $date = self::parserDate($valeurDate);
        if (!$date) {
            return null;
        }

        $secondes = self::parserHeure($valeurHeure);

        return $secondes === null ? $date : $date->copy()->addSeconds($secondes);
    }

    /**
     * Extrait la date+heure d'inventaire du titre du fichier de stock, par
     * exemple "INV emplacement 23/07/2026 08:06:56".
     *
     * Le libellé qui précède n'est pas fixe (il change selon le type
     * d'extraction ERP) : on cherche donc le motif date+heure n'importe où
     * dans la chaîne, plutôt que de découper à une position fixe.
     */
    public static function dansTitre(?string $titre): ?Carbon
    {
        if (!$titre) {
            return null;
        }

        // --- 1. La date -------------------------------------------------
        // L'ISO est cherché EN PREMIER : dans "2026-07-23", le motif
        // JJ-MM-AAAA attraperait "26-07-23" et donnerait le 26 juillet 2023.
        // Les gardes (?<!\d) / (?!\d) empêchent de découper un nombre plus long.
        $date = null;
        if (preg_match('#(?<!\d)(\d{4}-\d{1,2}-\d{1,2})(?!\d)#', $titre, $m)) {
            $date = self::parserDate($m[1]);
        } elseif (preg_match('#(?<!\d)(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})(?!\d)#', $titre, $m)) {
            $date = self::parserDate($m[1]);
        }

        if (!$date) {
            return null;
        }

        // --- 2. L'heure -------------------------------------------------
        // Le titre en contient souvent DEUX : la cellule "date" ressort en
        // "2026-07-23 00:00:00" (sa partie horaire est vide) et la vraie heure
        // d'inventaire suit dans une cellule à part ("08:06:56"). On garde donc
        // la dernière heure non nulle ; s'il n'y en a pas, minuit convient.
        if (!preg_match_all('#(?<!\d)(\d{1,2}:\d{2}(?::\d{2})?)(?!\d)#', $titre, $m)) {
            return $date;
        }

        foreach (array_reverse($m[1]) as $heure) {
            $secondes = self::parserHeure($heure);
            if ($secondes !== null && $secondes > 0) {
                return $date->copy()->addSeconds($secondes);
            }
        }

        return $date;
    }

    /** Refuse les heures hors bornes plutôt que de les faire déborder sur le jour suivant. */
    private static function secondes(int $h, int $m, int $s): ?int
    {
        if ($h < 0 || $h > 23 || $m < 0 || $m > 59 || $s < 0 || $s > 59) {
            return null;
        }

        return $h * 3600 + $m * 60 + $s;
    }
}
