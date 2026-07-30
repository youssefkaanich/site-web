/**
 * Règle métier de validité d'un code article Sopal.
 *
 * Un code article valide a un "A" en 5e position (ex: 06CZ[A]04-1, 0103[A]03-1).
 * Les codes qui ne respectent pas ça viennent presque toujours d'une erreur
 * d'extraction (texte libre mal découpé, quantité prise pour un code...).
 *
 * EXCEPTION : les commandes extraites d'une IMAGE (OCR) sont toujours
 * considérées valides, même sans "A" en 5e position — l'OCR peut déformer un
 * caractère, on préfère garder la ligne et la corriger à la main plutôt que
 * de la faire disparaître.
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

    return code.length >= 5 && code[4].toUpperCase() === 'A';
}
