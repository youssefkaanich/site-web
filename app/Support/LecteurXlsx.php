<?php

namespace App\Support;

/**
 * Lecture bas niveau des fichiers Excel de l'ERP, mise en commun entre le
 * fichier de stock (StockController) et le fichier de mouvements
 * (MouvementStore) — les deux ont la même forme générale : quelques lignes
 * d'en-tête de rapport, puis une ligne de noms de colonnes, puis les données.
 *
 * La seule différence est la POSITION de la ligne des noms de colonnes :
 *   - fichier de stock      : toujours la 2e ligne (nettoyé en amont par basestock.py)
 *   - fichier de mouvements : variable (bloc "SELECTIONS", critères de tri...),
 *                             d'où trouverLigneEntetes().
 */
class LecteurXlsx
{
    /** Nombre de lignes examinées au maximum pour retrouver la ligne des noms de colonnes. */
    private const LIGNES_SCRUTEES = 30;

    /** Lit le fichier et retourne la grille brute (tableau de tableaux, indices numériques). */
    public static function grille(string $chemin): array
    {
        $classeur = \PhpOffice\PhpSpreadsheet\IOFactory::load($chemin);

        // formatData = true : une cellule typée date ressort en "01/01/2026"
        // plutôt qu'en numéro de série Excel. DateSopal sait lire les deux,
        // mais la forme texte est plus lisible en cas de diagnostic.
        return $classeur->getActiveSheet()->toArray(null, true, true, false);
    }

    /**
     * Compare des noms de colonnes en ignorant accents, espaces, tirets et
     * casse : les en-têtes ERP sont parfois coupés en deux lignes dans la
     * cellule ("Emplac-\nement") ou tronqués ("Désignatio").
     *
     * ATTENTION : même règle que normaliserLabel() dans
     * resources/js/utils/colonnesStock.js et que normaliser() dans
     * basestock.py. Toute modification doit être reportée aux deux autres.
     */
    public static function normaliser(?string $label): string
    {
        $sansAccents = iconv('UTF-8', 'ASCII//TRANSLIT', (string) $label);
        $sansAccents = $sansAccents !== false ? $sansAccents : (string) $label;

        return strtolower(preg_replace('/[^a-zA-Z0-9]+/', '', $sansAccents));
    }

    /**
     * Retrouve l'indice de la ligne contenant les noms de colonnes : la
     * première ligne où TOUS les mots-clés demandés apparaissent.
     *
     * On exige plusieurs mots-clés simultanément parce que le fichier de
     * mouvements répète son titre plusieurs fois avant le vrai tableau ; une
     * recherche sur un seul mot tomberait sur une ligne de sélection.
     *
     * @param  array<string>  $motsCles  cherchés en version normalisée, en "commence par"
     */
    public static function trouverLigneEntetes(array $grille, array $motsCles): ?int
    {
        $limite = min(count($grille), self::LIGNES_SCRUTEES);

        for ($i = 0; $i < $limite; $i++) {
            $cellules = array_map(fn ($c) => self::normaliser((string) $c), $grille[$i] ?? []);

            $tousPresents = true;
            foreach ($motsCles as $motCle) {
                $present = false;
                foreach ($cellules as $cellule) {
                    if ($cellule !== '' && str_starts_with($cellule, $motCle)) {
                        $present = true;
                        break;
                    }
                }
                if (!$present) {
                    $tousPresents = false;
                    break;
                }
            }

            if ($tousPresents) {
                return $i;
            }
        }

        return null;
    }

    /**
     * Transforme la grille brute en [colonnes, lignes] au format utilisé
     * partout dans l'application :
     *   colonnes : [['key' => 'col_0', 'label' => 'Article', 'numeric' => false], ...]
     *   lignes   : [['_id' => 0, 'col_0' => '0103A03-1', ...], ...]
     */
    public static function tableau(array $grille, int $ligneEntetes = 0): array
    {
        if (empty($grille) || !isset($grille[$ligneEntetes])) {
            return [[], []];
        }

        $entetes = array_map(
            fn ($e, $i) => (string) ($e !== null && $e !== '' ? $e : "Colonne {$i}"),
            $grille[$ligneEntetes],
            array_keys($grille[$ligneEntetes])
        );

        $lignesDonnees = array_slice($grille, $ligneEntetes + 1);

        $lignes = [];
        foreach ($lignesDonnees as $index => $ligne) {
            $objet = ['_id' => $index];
            foreach ($entetes as $i => $label) {
                $objet["col_{$i}"] = $ligne[$i] ?? '';
            }
            $lignes[] = $objet;
        }

        $colonnes = [];
        foreach ($entetes as $i => $label) {
            $valeurs = collect(array_column($lignesDonnees, $i))->filter(fn ($v) => $v !== '' && $v !== null);
            $numerique = $valeurs->isNotEmpty() && $valeurs->every(fn ($v) => is_numeric($v));
            $colonnes[] = ['key' => "col_{$i}", 'label' => $label, 'numeric' => $numerique];
        }

        return [$colonnes, $lignes];
    }

    /**
     * Retrouve une colonne par mot-clé (en version normalisée, en "contient").
     * Les mots-clés sont essayés dans l'ordre : le premier qui correspond gagne,
     * ce qui permet d'écrire trouverColonne($cols, 'qtestock', 'qte').
     *
     * @return array{key: string, label: string, numeric: bool}|null
     */
    public static function trouverColonne(array $colonnes, string ...$motsCles): ?array
    {
        foreach ($motsCles as $motCle) {
            foreach ($colonnes as $colonne) {
                if (str_contains(self::normaliser($colonne['label'] ?? ''), $motCle)) {
                    return $colonne;
                }
            }
        }

        return null;
    }
}
