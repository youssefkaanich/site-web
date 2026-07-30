/**
 * Répartition des commandes du service Export entre les deux sous-onglets
 * de "Commande ferme" : Export (commande ferme classique) et Chantier.
 *
 * Une commande Export est classée "Chantier" dès que le mot "chantier"
 * apparaît dans l'objet du mail OU dans le corps du mail. Recherche
 * insensible à la casse et aux accents (les mails arrivent aussi bien en
 * "CHANTIER" qu'en "Chantier").
 *
 * Les deux sous-onglets sont MUTUELLEMENT EXCLUSIFS : une commande qui n'est
 * pas Chantier est forcément Export, et inversement — il suffit donc de
 * tester estChantier() et de prendre la branche opposée pour l'autre onglet.
 *
 * Le service Commercial n'est pas concerné par cette règle.
 *
 * ATTENTION : règle reproduite à l'identique côté serveur dans
 * CommandeController::estChantier() (le filtrage réel se fait là-bas, cette
 * version sert de garde-fou d'affichage). Toute modification ici doit être
 * reportée là-bas — même principe que estArticleValide().
 */
export function estChantier(objet, texte) {
    const contenu = `${objet ?? ''} ${texte ?? ''}`
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, ''); // retire les accents

    return /chantier/i.test(contenu);
}
