/**
 * Règle métier de validité d'un code article Sopal.
 *
 * Un code article valide a un "A" ou un "B" en 5e position
 * (ex: 06CZ[A]04-1, 0103[A]03-1, 06BA[B]01-1). Les codes qui ne respectent pas
 * ça viennent presque toujours d'une erreur d'extraction (texte libre mal
 * découpé, quantité prise pour un code...).
 *
 * EXCEPTION : les commandes extraites d'une IMAGE (OCR) sont toujours
 * considérées valides, quel que soit ce caractère — l'OCR peut le déformer, on
 * préfère garder la ligne et la corriger à la main plutôt que de la faire
 * disparaître.
 *
 * Sert UNIQUEMENT de filtre d'affichage : rien n'est supprimé en base, il
 * suffit de retirer le filtre pour revoir toutes les lignes.
 *
 * ATTENTION : cette règle est reproduite à l'identique côté serveur dans
 * CommandeController::estArticleValide() (pour que les compteurs de groupes
 * calculés en PHP correspondent). Toute modification ici doit être reportée
 * là-bas — même principe que normaliserLabel() (basestock.py <-> StockController).
 */
export function estArticleValide(article, source) {
    if (source === 'image-ocr') return true;

    const code = String(article ?? '').trim();

    // code[4] = 5e caractère (les index commencent à 0).
    // toUpperCase() : le code peut arriver en minuscules selon la source.
    return code.length >= 5 && ['A', 'B'].includes(code[4].toUpperCase());
}
