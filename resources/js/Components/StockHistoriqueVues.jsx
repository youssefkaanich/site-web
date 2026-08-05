import { useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import axios from 'axios';
import CourbeEvolution from './CourbeEvolution';
import {
    IconSearch,
    IconBarChart,
    IconBox,
    IconAlertTriangle,
    IconChevronLeft,
    IconChevronRight,
} from './Icons';

/**
 * Les trois vues d'analyse du stock historique, regroupees ici pour etre
 * affichees dans la page Stock / Production.
 *
 * L'IMPORT des deux fichiers reste sur la page Stock historique : un seul
 * endroit ou deposer les fichiers, un seul endroit ou les consulter.
 */

const LIGNES_PAR_PAGE = 50;

const VUES = [
    { cle: 'article', libelle: 'Un article à une date', icone: IconSearch },
    { cle: 'evolution', libelle: 'Évolution dans le temps', icone: IconBarChart },
    { cle: 'tous', libelle: 'Tous les articles', icone: IconBox },
];

function formaterNombre(valeur, decimales = 2) {
    if (valeur === null || valeur === undefined || valeur === '') return '—';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(valeur);
}

function formaterInstant(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Convertit un instant ISO en valeur acceptée par <input type="datetime-local">. */
function versChampDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Encadré rouge d'erreur, identique dans les trois vues. */
function Alerte({ message }) {
    if (!message) return null;
    return (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
            <IconAlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{message}</span>
        </div>
    );
}

/** Grand chiffre mis en avant (stock calculé). */
function Chiffre({ libelle, valeur, accent = false, aide = null }) {
    return (
        <div
            className={`rounded-2xl border p-4 ${
                accent
                    ? 'border-[#0d2b52]/20 dark:border-blue-400/30 bg-[#0d2b52]/[0.04] dark:bg-blue-400/[0.07]'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
            }`}
        >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {libelle}
            </p>
            <p
                className={`mt-1.5 font-bold tabular-nums ${
                    accent ? 'text-3xl text-[#0d2b52] dark:text-blue-300' : 'text-2xl text-slate-800 dark:text-slate-100'
                }`}
            >
                {valeur}
            </p>
            {aide && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{aide}</p>}
        </div>
    );
}


/** Sélecteur d'article avec recherche (liste de ~1 200 références). */
function ChampArticle({ articles, valeur, onChange }) {
    return (
        <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Article</label>
            <input
                list="liste-articles-historique"
                value={valeur}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Tape un code article, ex : 0103A03-1"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
            />
            <datalist id="liste-articles-historique">
                {articles.map((a) => (
                    <option key={a.article} value={a.article}>
                        {a.designation ?? ''}
                    </option>
                ))}
            </datalist>
        </div>
    );
}

function ChampInstant({ libelle, valeur, min, onChange }) {
    return (
        <div className="min-w-[210px]">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{libelle}</label>
            <input
                type="datetime-local"
                value={valeur}
                min={min}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
            />
        </div>
    );
}

const BOUTON =
    'px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end';

/* ==================================================================
   VUE 1 — Stock d'un article à une date/heure précise
   ================================================================== */

function VueArticle({ articles, minChamp, finMouvements }) {
    const [article, setArticle] = useState('');
    const [instant, setInstant] = useState(versChampDate(finMouvements) || minChamp);
    const [resultat, setResultat] = useState(null);
    const [erreur, setErreur] = useState(null);
    const [chargement, setChargement] = useState(false);

    function calculer() {
        if (!article.trim()) {
            setErreur('Choisis un article.');
            return;
        }
        setChargement(true);
        setErreur(null);

        axios
            .get('/stock-historique/article', { params: { article: article.trim(), instant } })
            .then(({ data }) => {
                setResultat(data);
                setErreur(null);
            })
            .catch((e) => {
                setResultat(null);
                setErreur(e.response?.data?.erreur ?? 'Le calcul a échoué.');
            })
            .finally(() => setChargement(false));
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                <ChampArticle articles={articles} valeur={article} onChange={setArticle} />
                <ChampInstant libelle="Stock à la date du" valeur={instant} min={minChamp} onChange={setInstant} />
                <button type="button" onClick={calculer} disabled={chargement} className={BOUTON}>
                    {chargement ? 'Calcul…' : 'Calculer'}
                </button>
            </div>

            <Alerte message={erreur} />

            {resultat && (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Chiffre
                            libelle="Stock de référence"
                            valeur={formaterNombre(resultat.stockReference)}
                            aide={
                                resultat.presentEnReference
                                    ? 'somme de tous ses emplacements'
                                    : 'article absent du fichier de stock : départ à 0'
                            }
                        />
                        <Chiffre
                            libelle="Mouvements depuis"
                            valeur={`${resultat.variation > 0 ? '+' : ''}${formaterNombre(resultat.variation)}`}
                            aide={`${resultat.mouvements.length} mouvement${resultat.mouvements.length > 1 ? 's' : ''} pris en compte`}
                        />
                        <Chiffre
                            libelle="Stock à la date choisie"
                            valeur={formaterNombre(resultat.stock)}
                            accent
                            aide={formaterInstant(resultat.instant)}
                        />
                    </div>

                    {resultat.designation && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            <strong className="text-slate-800 dark:text-slate-100">{resultat.article}</strong> —{' '}
                            {resultat.designation}
                        </p>
                    )}

                    <TableauMouvements mouvements={resultat.mouvements} horsPeriode={resultat.horsPeriode} />
                </>
            )}
        </div>
    );
}

function TableauMouvements({ mouvements, horsPeriode }) {
    if (!mouvements.length) {
        return (
            <p className="text-sm text-slate-500 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                Aucun mouvement pour cet article entre la date de référence et la date choisie : son stock n'a pas bougé.
                {horsPeriode > 0 && ` (${horsPeriode} mouvement${horsPeriode > 1 ? 's' : ''} plus récent${horsPeriode > 1 ? 's' : ''} non compté${horsPeriode > 1 ? 's' : ''}.)`}
            </p>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                    Détail des {mouvements.length} mouvements pris en compte
                </h3>
                {horsPeriode > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {horsPeriode} mouvement{horsPeriode > 1 ? 's' : ''} postérieur{horsPeriode > 1 ? 's' : ''} à la date
                        choisie {horsPeriode > 1 ? 'ont' : 'a'} été écarté{horsPeriode > 1 ? 's' : ''}.
                    </p>
                )}
            </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <th className="px-4 py-2.5">Date et heure</th>
                            <th className="px-4 py-2.5">Transaction</th>
                            <th className="px-4 py-2.5">Pièce origine</th>
                            <th className="px-4 py-2.5">Emplacement</th>
                            <th className="px-4 py-2.5 text-right">Mouvement</th>
                            <th className="px-4 py-2.5 text-right">Stock après</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {mouvements.map((m, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                                    {formaterInstant(m.instant)}
                                </td>
                                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{m.transaction ?? '—'}</td>
                                <td className="px-4 py-2 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                    {m.piece ?? '—'}
                                </td>
                                <td className="px-4 py-2 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                    {m.emplacement ?? '—'}
                                </td>
                                <td
                                    className={`px-4 py-2 text-right font-semibold tabular-nums ${
                                        m.quantite < 0
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                >
                                    {m.quantite > 0 ? '+' : ''}
                                    {formaterNombre(m.quantite)}
                                </td>
                                <td className="px-4 py-2 text-right text-slate-800 dark:text-slate-100 tabular-nums">
                                    {formaterNombre(m.stockApres)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ==================================================================
   VUE 2 — Évolution d'un article dans le temps
   ================================================================== */

function VueEvolution({ articles }) {
    const [article, setArticle] = useState('');
    const [donnees, setDonnees] = useState(null);
    const [erreur, setErreur] = useState(null);
    const [chargement, setChargement] = useState(false);

    // Les codes connus, pour ne lancer une requête que sur une saisie complète.
    const codesConnus = useMemo(() => new Set(articles.map((a) => a.article)), [articles]);

    /**
     * Tracé DYNAMIQUE : la courbe se met à jour dès que l'article saisi
     * correspond à une référence connue, sans bouton à cliquer.
     *
     * Le délai de 250 ms évite d'envoyer une requête à chaque frappe pendant
     * que l'utilisateur tape son code ; et la requête n'est lancée que si le
     * code existe, pour ne pas interroger le serveur sur des saisies partielles.
     */
    useEffect(() => {
        const code = article.trim();

        if (!code) {
            setDonnees(null);
            setErreur(null);
            return;
        }

        if (!codesConnus.has(code)) {
            setDonnees(null);
            setErreur(null);
            return;
        }

        let annule = false;
        setChargement(true);

        const minuteur = setTimeout(() => {
            axios
                .get('/stock-historique/evolution', { params: { article: code } })
                .then(({ data }) => {
                    if (annule) return;
                    setDonnees(data);
                    setErreur(null);
                })
                .catch((e) => {
                    if (annule) return;
                    setDonnees(null);
                    setErreur(e.response?.data?.erreur ?? 'Le tracé a échoué.');
                })
                .finally(() => !annule && setChargement(false));
        }, 250);

        // Saisie modifiée avant la fin : on annule la requête précédente pour
        // qu'une réponse tardive n'écrase pas une plus récente.
        return () => {
            annule = true;
            clearTimeout(minuteur);
        };
    }, [article, codesConnus]);

    const bornes = useMemo(() => {
        if (!donnees?.points?.length) return null;
        const stocks = donnees.points.map((p) => p.stock);
        return { min: Math.min(...stocks), max: Math.max(...stocks), fin: stocks[stocks.length - 1] };
    }, [donnees]);

    const saisieIncomplete = article.trim() !== '' && !codesConnus.has(article.trim());

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                <ChampArticle articles={articles} valeur={article} onChange={setArticle} />
                <div className="pb-2 text-xs text-slate-500 dark:text-slate-400 min-w-[170px]">
                    {chargement ? (
                        <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-[#0d2b52] dark:border-t-blue-400 animate-spin" />
                            Tracé en cours…
                        </span>
                    ) : saisieIncomplete ? (
                        'Référence inconnue — continue la saisie'
                    ) : donnees ? (
                        'La courbe se met à jour automatiquement'
                    ) : (
                        'Choisis un article pour voir sa courbe'
                    )}
                </div>
            </div>

            <Alerte message={erreur} />

            {donnees && bornes && (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Chiffre libelle="Stock le plus bas" valeur={formaterNombre(bornes.min)} />
                        <Chiffre libelle="Stock le plus haut" valeur={formaterNombre(bornes.max)} />
                        <Chiffre libelle="Stock en fin de période" valeur={formaterNombre(bornes.fin)} accent />
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-1">
                            Évolution du stock — {donnees.article}
                            {donnees.designation ? ` (${donnees.designation})` : ''}
                        </h3>
                        <CourbeEvolution
                            points={donnees.points}
                            article={donnees.article}
                            designation={donnees.designation}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

/* ==================================================================
   VUE 3 — Stock de tous les articles à une date donnée
   ================================================================== */

const COLONNES_TOUS = [
    { cle: 'article', libelle: 'Article', numerique: false },
    { cle: 'designation', libelle: 'Désignation', numerique: false },
    { cle: 'stockReference', libelle: 'Stock de référence', numerique: true },
    { cle: 'variation', libelle: 'Mouvements', numerique: true },
    { cle: 'stock', libelle: 'Stock à la date', numerique: true },
    { cle: 'nombreMouvements', libelle: 'Nb mvts', numerique: true },
];

function VueTous({ minChamp, finMouvements }) {
    const [instant, setInstant] = useState(versChampDate(finMouvements) || minChamp);
    const [lignes, setLignes] = useState(null);
    const [erreur, setErreur] = useState(null);
    const [chargement, setChargement] = useState(false);
    const [recherche, setRecherche] = useState('');
    const [tri, setTri] = useState({ cle: 'article', sens: 1 });
    const [page, setPage] = useState(1);

    function calculer() {
        setChargement(true);
        setErreur(null);

        axios
            .get('/stock-historique/tous', { params: { instant } })
            .then(({ data }) => {
                setLignes(data.lignes);
                setPage(1);
                setErreur(null);
            })
            .catch((e) => {
                setLignes(null);
                setErreur(e.response?.data?.erreur ?? 'Le calcul a échoué.');
            })
            .finally(() => setChargement(false));
    }

    function trierPar(cle) {
        setTri((t) => ({ cle, sens: t.cle === cle ? -t.sens : 1 }));
        setPage(1);
    }

    const affichees = useMemo(() => {
        if (!lignes) return [];
        const terme = recherche.trim().toLowerCase();

        const filtrees = terme
            ? lignes.filter(
                  (l) =>
                      l.article.toLowerCase().includes(terme) ||
                      String(l.designation ?? '').toLowerCase().includes(terme)
              )
            : lignes;

        const colonne = COLONNES_TOUS.find((c) => c.cle === tri.cle);
        return [...filtrees].sort((a, b) => {
            const va = a[tri.cle];
            const vb = b[tri.cle];
            if (colonne?.numerique) return ((va ?? 0) - (vb ?? 0)) * tri.sens;
            return String(va ?? '').localeCompare(String(vb ?? ''), 'fr') * tri.sens;
        });
    }, [lignes, recherche, tri]);

    const totalPages = Math.max(1, Math.ceil(affichees.length / LIGNES_PAR_PAGE));
    const pageCourante = Math.min(page, totalPages);
    const visibles = affichees.slice((pageCourante - 1) * LIGNES_PAR_PAGE, pageCourante * LIGNES_PAR_PAGE);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                <ChampInstant libelle="Stock de tous les articles au" valeur={instant} min={minChamp} onChange={setInstant} />
                <button type="button" onClick={calculer} disabled={chargement} className={BOUTON}>
                    {chargement ? 'Calcul…' : 'Calculer'}
                </button>
                {lignes && (
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Rechercher
                        </label>
                        <input
                            value={recherche}
                            onChange={(e) => {
                                setRecherche(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Code ou désignation"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d2b52]/30"
                        />
                    </div>
                )}
            </div>

            <Alerte message={erreur} />

            {lignes && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                            {formaterNombre(affichees.length, 0)} article{affichees.length > 1 ? 's' : ''}
                            {recherche && ` sur ${formaterNombre(lignes.length, 0)}`}
                        </h3>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={pageCourante === 1}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
                                >
                                    <IconChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="tabular-nums">
                                    page {pageCourante} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={pageCourante === totalPages}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
                                >
                                    <IconChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    {COLONNES_TOUS.map((c) => (
                                        <th
                                            key={c.cle}
                                            onClick={() => trierPar(c.cle)}
                                            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 ${
                                                c.numerique ? 'text-right' : 'text-left'
                                            }`}
                                        >
                                            {c.libelle}
                                            {tri.cle === c.cle && (tri.sens === 1 ? ' ↑' : ' ↓')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {visibles.map((l) => (
                                    <tr key={l.article} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                                            <Link
                                                href={`/stock-production/articles/${encodeURIComponent(l.article)}`}
                                                prefetch="hover"
                                                className="hover:underline"
                                            >
                                                {l.article}
                                            </Link>
                                            {!l.presentEnReference && (
                                                <span
                                                    className="ml-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                                                    title="Article absent du fichier de stock : son calcul démarre à 0"
                                                >
                                                    nouveau
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                                            {l.designation ?? '—'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                                            {formaterNombre(l.stockReference)}
                                        </td>
                                        <td
                                            className={`px-4 py-2 text-right font-medium tabular-nums ${
                                                l.variation < 0
                                                    ? 'text-rose-600 dark:text-rose-400'
                                                    : l.variation > 0
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-slate-400 dark:text-slate-500'
                                            }`}
                                        >
                                            {l.variation > 0 ? '+' : ''}
                                            {formaterNombre(l.variation)}
                                        </td>
                                        <td
                                            className={`px-4 py-2 text-right font-bold tabular-nums ${
                                                l.stock <= 0
                                                    ? 'text-rose-600 dark:text-rose-400'
                                                    : 'text-slate-800 dark:text-slate-100'
                                            }`}
                                        >
                                            {formaterNombre(l.stock)}
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                                            {l.nombreMouvements}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Barre d'onglets + la vue choisie. C'est le seul composant que les pages
 * importent.
 */
export default function VuesStockHistorique({ reference, mouvements, articles }) {
    const [vue, setVue] = useState('evolution');

    const minChamp = versChampDate(reference?.instant ?? null);
    const finMouvements = mouvements?.fin ? new Date(mouvements.fin * 1000).toISOString() : null;

    return (
        <div>
            <div className="flex flex-wrap gap-1.5 mb-5 border-b border-slate-200 dark:border-slate-700">
                {VUES.map(({ cle, libelle, icone: Icone }) => (
                    <button
                        key={cle}
                        type="button"
                        onClick={() => setVue(cle)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                            vue === cle
                                ? 'border-[#0d2b52] dark:border-blue-400 text-[#0d2b52] dark:text-blue-300'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <Icone className="h-4 w-4" />
                        {libelle}
                    </button>
                ))}
            </div>

            {vue === 'article' && (
                <VueArticle articles={articles} minChamp={minChamp} finMouvements={finMouvements} />
            )}
            {vue === 'evolution' && <VueEvolution articles={articles} />}
            {vue === 'tous' && <VueTous minChamp={minChamp} finMouvements={finMouvements} />}
        </div>
    );
}
