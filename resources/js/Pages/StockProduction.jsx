import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { router } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { trouverColonne } from '../utils/colonnesStock';

const LARGEUR_COLONNE = 150;
const LIGNES_PAR_PAGE = 50;
const CLE_STOCKAGE = 'sopal-stock-production';

// Garde le fichier importé le temps de l'onglet (survit à un rafraîchissement,
// mais reste bien "rien d'enregistré côté serveur" : uniquement dans le navigateur).
function chargerDepuisStockage() {
    try {
        const brut = sessionStorage.getItem(CLE_STOCKAGE);
        return brut ? JSON.parse(brut) : null;
    } catch {
        return null;
    }
}

function sauvegarderDansStockage(valeur) {
    try {
        if (valeur) {
            sessionStorage.setItem(CLE_STOCKAGE, JSON.stringify(valeur));
        } else {
            sessionStorage.removeItem(CLE_STOCKAGE);
        }
    } catch {
        // fichier trop volumineux pour sessionStorage : tant pis, pas bloquant
    }
}

function formaterDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function StockProduction() {
    const sauvegarde = chargerDepuisStockage();
    const [idActif, setIdActif] = useState(sauvegarde?.id ?? null);
    const [nomFichier, setNomFichier] = useState(sauvegarde?.nomFichier ?? null);
    const [titreStock, setTitreStock] = useState(sauvegarde?.titreStock ?? null);
    const [colonnes, setColonnes] = useState(sauvegarde?.colonnes ?? []);
    const [lignes, setLignes] = useState(sauvegarde?.lignes ?? []);
    const [erreur, setErreur] = useState(null);
    const [chargement, setChargement] = useState(false);
    const [recherche, setRecherche] = useState('');
    const [page, setPage] = useState(1);
    const [historique, setHistorique] = useState([]);
    const [widths, startResize, colonneActive] = useResizableColumns({});

    useEffect(() => {
        sauvegarderDansStockage(nomFichier ? { id: idActif, nomFichier, titreStock, colonnes, lignes } : null);
    }, [idActif, nomFichier, titreStock, colonnes, lignes]);

    function rafraichirHistorique() {
        axios
            .get('/stock-production/historique')
            .then(({ data }) => setHistorique(data))
            .catch(() => {});
    }

    useEffect(() => {
        rafraichirHistorique();

        // Revenu depuis la page d'un article (?import=...) : recharge cet
        // import précis depuis le serveur, même si le navigateur/onglet n'a
        // pas (ou plus) cette donnée en mémoire locale.
        const idDepuisUrl = new URLSearchParams(window.location.search).get('import');
        if (idDepuisUrl) {
            chargerImportHistorique(idDepuisUrl);
            window.history.replaceState(null, '', '/stock-production');
        }
    }, []);

    function importerFichier(e) {
        const fichier = e.target.files[0];
        e.target.value = ''; // permet de réimporter le même fichier ensuite
        if (!fichier) return;

        setErreur(null);
        setChargement(true);

        const donnees = new FormData();
        donnees.append('fichier', fichier);

        axios
            .post('/stock-production/importer', donnees)
            .then(({ data }) => {
                setIdActif(data.id);
                setNomFichier(data.nomFichier);
                setTitreStock(data.titreStock);
                setColonnes(data.colonnes);
                setLignes(data.lignes);
                setRecherche('');
                setPage(1);
                rafraichirHistorique();
            })
            .catch((err) => {
                setErreur(
                    err.response?.data?.erreur ||
                        err.response?.data?.errors?.fichier?.[0] ||
                        "Impossible de traiter ce fichier. Vérifie que c'est bien un fichier Excel (.xlsx, .xls) valide."
                );
            })
            .finally(() => setChargement(false));
    }

    function chargerImportHistorique(id) {
        if (id === idActif) return;

        setErreur(null);
        setChargement(true);

        axios
            .get(`/stock-production/historique/${id}`)
            .then(({ data }) => {
                setIdActif(data.id);
                setNomFichier(data.nomFichier);
                setTitreStock(data.titreStock);
                setColonnes(data.colonnes);
                setLignes(data.lignes);
                setRecherche('');
                setPage(1);
            })
            .catch(() => {
                setErreur('Impossible de recharger cet import (il a peut-être été supprimé).');
                rafraichirHistorique();
            })
            .finally(() => setChargement(false));
    }

    function supprimerImportHistorique(id, e) {
        e.stopPropagation();
        if (!confirm('Supprimer cet import de l\'historique ? Cette action est irréversible.')) return;

        axios
            .delete(`/stock-production/historique/${id}`)
            .then(() => {
                if (id === idActif) {
                    reinitialiser();
                }
                rafraichirHistorique();
            })
            .catch(() => setErreur("Impossible de supprimer cet import."));
    }

    function reinitialiser() {
        setIdActif(null);
        setNomFichier(null);
        setTitreStock(null);
        setColonnes([]);
        setLignes([]);
        setErreur(null);
        setRecherche('');
        setPage(1);
    }

    function changerRecherche(valeur) {
        setRecherche(valeur);
        setPage(1);
    }

    // Colonne "Article" (si présente) : permet de regrouper le tableau par article
    // et de rendre chaque ligne cliquable vers sa page de détail.
    const colonneArticle = trouverColonne(colonnes, 'article');
    const colonneDesignation = trouverColonne(colonnes, 'designation');
    const colonneQte = trouverColonne(colonnes, 'qte') || trouverColonne(colonnes, 'quantite');

    // Regroupe les lignes brutes (une par emplacement) en une ligne par article.
    const lignesGroupees = useMemo(() => {
        if (!colonneArticle) return null;

        const groupes = new Map();
        for (const ligne of lignes) {
            const code = ligne[colonneArticle.key];
            if (!code) continue;
            if (!groupes.has(code)) {
                groupes.set(code, {
                    _id: code,
                    article: code,
                    designation: colonneDesignation ? ligne[colonneDesignation.key] : '',
                    nombreEmplacements: 0,
                    quantiteTotale: 0,
                });
            }
            const groupe = groupes.get(code);
            groupe.nombreEmplacements += 1;
            if (colonneQte) {
                groupe.quantiteTotale += Number(ligne[colonneQte.key]) || 0;
            }
        }
        return Array.from(groupes.values());
    }, [lignes, colonneArticle, colonneDesignation, colonneQte]);

    const modeGroupe = lignesGroupees !== null;

    const rechercheNormalisee = recherche.trim().toLowerCase();
    const lignesFiltrees = modeGroupe
        ? rechercheNormalisee
            ? lignesGroupees.filter(
                  (g) =>
                      String(g.article).toLowerCase().includes(rechercheNormalisee) ||
                      String(g.designation ?? '').toLowerCase().includes(rechercheNormalisee)
              )
            : lignesGroupees
        : rechercheNormalisee
        ? lignes.filter((ligne) =>
              colonnes.some((col) => String(ligne[col.key] ?? '').toLowerCase().includes(rechercheNormalisee))
          )
        : lignes;

    const totalPages = Math.max(1, Math.ceil(lignesFiltrees.length / LIGNES_PAR_PAGE));
    const pageCourante = Math.min(page, totalPages);
    const lignesAffichees = lignesFiltrees.slice(
        (pageCourante - 1) * LIGNES_PAR_PAGE,
        pageCourante * LIGNES_PAR_PAGE
    );

    // Navigation clavier : flèche droite = page suivante, flèche gauche =
    // page précédente. Désactivé pendant une saisie (ex: champ de recherche)
    // pour ne pas gêner le déplacement du curseur dans le texte.
    useEffect(() => {
        function surTouche(e) {
            const cible = e.target;
            const enSaisie = cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.isContentEditable;
            if (enSaisie) return;

            if (e.key === 'ArrowRight') {
                setPage((p) => Math.min(totalPages, p + 1));
            } else if (e.key === 'ArrowLeft') {
                setPage((p) => Math.max(1, p - 1));
            }
        }

        window.addEventListener('keydown', surTouche);
        return () => window.removeEventListener('keydown', surTouche);
    }, [totalPages]);

    function ouvrirArticle(codeArticle) {
        if (!idActif || !codeArticle) return;
        router.visit(`/stock-production/${idActif}/articles/${encodeURIComponent(codeArticle)}`);
    }

    // En mode groupé, le tableau affiche des colonnes fixes (résumé) au lieu
    // des colonnes brutes du fichier (dispo en détail sur la page de l'article).
    const colonnesAffichees = modeGroupe
        ? [
              { key: 'article', label: 'Article', numeric: false },
              { key: 'designation', label: 'Désignation', numeric: false },
              { key: 'nombreEmplacements', label: 'Emplacements', numeric: true },
              ...(colonneQte ? [{ key: 'quantiteTotale', label: 'Quantité totale', numeric: true }] : []),
          ]
        : colonnes;

    return (
        <AppLayout
            title="Stock / Production"
            subtitle="Importe un fichier Excel : il est nettoyé et filtré automatiquement, puis gardé dans l'historique (les 10 derniers imports) pour pouvoir y revenir."
        >
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <label
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 hover:shadow-md hover:shadow-[#0d2b52]/20 cursor-pointer flex items-center gap-2 transition-all ${
                        chargement ? 'opacity-60 pointer-events-none' : ''
                    }`}
                >
                    {chargement ? (
                        <>
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            Traitement en cours…
                        </>
                    ) : (
                        <>📂 Importer un fichier Excel</>
                    )}
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={importerFichier}
                        disabled={chargement}
                        className="hidden"
                    />
                </label>
                {nomFichier && (
                    <>
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl shadow-sm">
                            📄 {nomFichier}
                        </span>
                        <button
                            onClick={reinitialiser}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition"
                        >
                            × Retirer le fichier
                        </button>
                    </>
                )}
            </div>

            {historique.length > 0 && (
                <div className="mb-6">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2.5 uppercase tracking-wide">
                        📁 Historique des imports · {historique.length}/10
                    </p>
                    <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {historique.map((item) => {
                            const estActif = item.id === idActif;
                            return (
                                <div key={item.id} className="relative shrink-0 group">
                                    <button
                                        onClick={() => chargerImportHistorique(item.id)}
                                        disabled={chargement}
                                        title={item.nomFichier}
                                        className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-all disabled:opacity-50 ${
                                            estActif
                                                ? 'bg-[#0d2b52] border-[#0d2b52] text-white shadow-md shadow-[#0d2b52]/20'
                                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                                        }`}
                                    >
                                        <p className="font-semibold max-w-[170px] truncate flex items-center gap-1.5">
                                            {estActif && <span>✓</span>}
                                            {item.nomFichier}
                                        </p>
                                        <p className={estActif ? 'text-blue-100/70 mt-0.5' : 'text-gray-400 dark:text-gray-500 mt-0.5'}>
                                            {formaterDate(item.horodatage)} · {item.nombreLignes} lignes
                                        </p>
                                    </button>
                                    <button
                                        onClick={(e) => supprimerImportHistorique(item.id, e)}
                                        title="Supprimer cet import"
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {erreur && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
                    ⚠️ {erreur}
                </div>
            )}

            {nomFichier && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Lignes</p>
                        <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{lignes.length}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Colonnes</p>
                        <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{colonnes.length}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">🕒 Date du stock</p>
                        <p className="text-lg font-extrabold mt-3 text-[#0d2b52] dark:text-white leading-snug">
                            {titreStock || '—'}
                        </p>
                    </div>
                </div>
            )}

            {nomFichier && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="relative w-full sm:w-72">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm pointer-events-none">
                            🔎
                        </span>
                        <input
                            type="text"
                            value={recherche}
                            onChange={(e) => changerRecherche(e.target.value)}
                            placeholder="Rechercher dans le tableau…"
                            className="w-full border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30 focus:border-[#0d2b52] dark:focus:border-blue-400 transition"
                        />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {modeGroupe ? (
                            <>
                                {lignesFiltrees.length} article{lignesFiltrees.length > 1 ? 's' : ''}
                                {rechercheNormalisee ? ` sur ${lignesGroupees.length}` : ''} · groupé par article
                            </>
                        ) : (
                            <>
                                {lignesFiltrees.length} résultat{lignesFiltrees.length > 1 ? 's' : ''}
                                {rechercheNormalisee ? ` sur ${lignes.length}` : ''}
                            </>
                        )}
                    </span>
                </div>
            )}

            {!nomFichier && !erreur && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-gray-700 px-4 py-20 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">Importe un fichier Excel pour voir son contenu ici.</p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                        Les colonnes et lignes inutiles sont filtrées automatiquement.
                    </p>
                </div>
            )}

            {nomFichier && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed border-collapse">
                            <colgroup>
                                {colonnesAffichees.map((col) => (
                                    <col key={col.key} style={{ width: widths[col.key] ?? LARGEUR_COLONNE }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                    {colonnesAffichees.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`sticky top-0 z-[1] relative px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide truncate select-none bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 last:border-r-0 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] ${
                                                col.numeric ? 'text-right' : 'text-left'
                                            }`}
                                        >
                                            {col.label}
                                            <span
                                                onMouseDown={(e) => startResize(e, col.key)}
                                                className="absolute top-0 right-0 flex h-full w-3 -mr-1.5 cursor-col-resize items-stretch justify-center z-10 group"
                                            >
                                                <span
                                                    className={`w-[3px] my-1 rounded-full transition-all duration-150 ${
                                                        colonneActive === col.key
                                                            ? 'bg-[#0d2b52] dark:bg-blue-400 w-1'
                                                            : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-400 group-hover:w-1'
                                                    }`}
                                                />
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lignesAffichees.map((ligne, index) => (
                                    <tr
                                        key={ligne._id}
                                        onClick={() => ouvrirArticle(modeGroupe ? ligne.article : ligne[colonneArticle?.key])}
                                        title={colonneArticle ? "Voir le détail de l'article" : undefined}
                                        className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/60 dark:hover:bg-gray-800/60 transition-colors ${
                                            colonneArticle ? 'cursor-pointer' : ''
                                        } ${index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'}`}
                                    >
                                        {colonnesAffichees.map((col) => (
                                            <td
                                                key={col.key}
                                                title={String(ligne[col.key] ?? '')}
                                                className={`px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200 truncate ${
                                                    col.numeric ? 'text-right tabular-nums' : ''
                                                }`}
                                            >
                                                {ligne[col.key] === '' ? '—' : String(ligne[col.key])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {lignesFiltrees.length === 0 && (
                                    <tr>
                                        <td colSpan={colonnesAffichees.length} className="px-4 py-8 text-center text-gray-400 dark:text-gray-600">
                                            {rechercheNormalisee
                                                ? 'Aucune ligne ne correspond à ta recherche.'
                                                : "Ce fichier n'a pas de lignes de données (juste des en-têtes)."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={pageCourante === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 transition"
                            >
                                ← Précédent
                            </button>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                Page {pageCourante} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={pageCourante === totalPages}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 transition"
                            >
                                Suivant →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </AppLayout>
    );
}
