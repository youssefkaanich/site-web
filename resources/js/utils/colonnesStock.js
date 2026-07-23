const REGEX_ACCENTS = new RegExp('[̀-ͯ]', 'g');

export function normaliserLabel(texte) {
    return String(texte ?? '')
        .normalize('NFD')
        .replace(REGEX_ACCENTS, '') // enleve les accents (e.g. "e" + accent -> "e")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

export function trouverColonne(colonnes, motCle) {
    return colonnes.find((c) => normaliserLabel(c.label).includes(motCle));
}
