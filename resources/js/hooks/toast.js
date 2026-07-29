// Petit système de notifications "toast" sans dépendance : n'importe quel
// composant peut appeler toast(message) pour afficher une notification
// temporaire, sans avoir à passer des props à travers toute l'arborescence.
// <Toaster /> (montée une seule fois dans AppLayout) écoute et affiche.

let compteur = 0;
let ecouteurs = [];

export function toast(message, type = 'success') {
    const item = { id: ++compteur, message, type };
    ecouteurs.forEach((fn) => fn(item));
}

export function ecouterToasts(fn) {
    ecouteurs.push(fn);
    return () => {
        ecouteurs = ecouteurs.filter((f) => f !== fn);
    };
}
