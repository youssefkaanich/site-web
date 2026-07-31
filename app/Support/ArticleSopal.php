<?php

namespace App\Support;

/**
 * Règle métier de validité d'un code article Sopal, partagée par les
 * commandes (CommandeController) et le stock (StockController) — pour qu'un
 * même code soit jugé de la même façon des deux côtés.
 *
 * ATTENTION : règle reproduite à l'identique côté React dans
 * resources/js/utils/articleValidation.js (filtre d'affichage du tableau des
 * commandes). Toute modification ici doit être reportée là-bas.
 */
class ArticleSopal
{
    /**
     * Un code article valide a un "A" ou un "B" en 5e position
     * (ex: 06CZ[A]04-1, 06BA[B]01-1). Les codes qui ne respectent pas ça
     * viennent presque toujours d'une erreur d'extraction ou d'une ligne
     * parasite dans le fichier source.
     *
     * $source == "image-ocr" (commandes extraites d'une image) : toujours
     * valide, quel que soit ce caractère — l'OCR peut le déformer, on préfère
     * garder la ligne et la corriger à la main. Le stock n'utilise pas ce
     * paramètre (il vient d'un export Excel, pas d'un OCR).
     */
    public static function estValide(?string $code, ?string $source = null): bool
    {
        if ($source === 'image-ocr') {
            return true;
        }

        $code = trim((string) $code);

        // $code[4] = 5e caractère (les index commencent à 0).
        // strtoupper() : le code peut arriver en minuscules selon la source.
        return strlen($code) >= 5 && in_array(strtoupper($code[4]), ['A', 'B'], true);
    }
}
