import { useMemo, useState } from 'react';
import { router, Link } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import BadgeJob from '../Components/BadgeJob';
import { IconRestore, IconInbox, IconChevronRight } from '../Components/Icons';
import { correspondACategorie } from '../utils/classificationCommande';

/**
 * Mêmes vues que la page Commandes, et MÊME regroupement :
 *
 *   Commande ferme > Export   -> groupé par objet du mail
 *   Commande ferme > Chantier -> groupé par émetteur
 *   Commercial                -> groupé par émetteur
 *
 * Le classement vient de correspondACategorie() : une seule règle pour tout le
 * site, pas une copie propre à cette page.
 */
const VUES = [
    { cle: 'toutes', libelle: 'Toutes', groupe: null },
    { cle: 'export', libelle: 'Export', groupe: 'Objet', libelleGroupe: 'objet' },
    { cle: 'chantier', libelle: 'Chantier', groupe: 'Emetteur', libelleGroupe: 'émetteur' },
    { cle: 'commercial', libelle: 'Commercial', groupe: 'Emetteur', libelleGroupe: 'émetteur' },
];

const SANS_VALEUR = '(non renseigné)';

const SOUS_TITRE =
    'Commandes entièrement servies depuis le stock — leur historique reste consultable et annulable.';

/** Formate une date de service en "12/07 à 14:32". */
function dateService(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** La vue "Toutes" ne filtre rien ; les autres suivent la règle commune du site. */
function estDansLaVue(commande, categorie) {
    return categorie === 'toutes' ? true : correspondACategorie(commande, categorie);
}

/**
 * Commandes entièrement servies : archive consultable, avec le détail des
 * sorties de stock (dates + quantités) et deux façons de revenir en arrière.
 */
export default function CommandesServies({ commandes = [] }) {
    const [vue, setVue] = useState('toutes');
    const [repliés, setRepliés] = useState({});

    /** Annule une sortie : la quantité est restituée au stock et la commande repasse en cours. */
    function annulerService(serviceId) {
        router.delete(`/services/${serviceId}`, { preserveScroll: true });
    }

    /** Remet la commande dans la vue active sans toucher à son historique. */
    function reactiver(id) {
        router.post(`/commandes/${id}/reactiver`, {}, { preserveScroll: true });
    }

    // Compteurs des onglets : calculés avec la même règle que le contenu, pour
    // qu'un onglet n'annonce jamais un nombre qu'il n'affiche pas.
    const parVue = useMemo(() => {
        const resultat = {};
        for (const { cle } of VUES) {
            resultat[cle] = commandes.filter((c) => estDansLaVue(c, cle));
        }
        return resultat;
    }, [commandes]);

    const vueCourante = VUES.find((v) => v.cle === vue) ?? VUES[0];
    const liste = parVue[vue] ?? [];

    // Regroupement selon la vue : par objet pour Export, par émetteur pour
    // Chantier et Commercial. La vue "Toutes" reste une liste simple — ses
    // commandes n'ont pas de critère commun.
    const groupes = useMemo(() => {
        if (!vueCourante.groupe) return null;

        const carte = new Map();
        for (const c of liste) {
            const cle = String(c[vueCourante.groupe] ?? '').trim() || SANS_VALEUR;
            if (!carte.has(cle)) carte.set(cle, []);
            carte.get(cle).push(c);
        }

        // Les groupes les plus fournis en premier : ce sont ceux qui portent
        // l'essentiel de l'activité.
        return [...carte.entries()]
            .map(([nom, lignes]) => ({ nom, lignes }))
            .sort((a, b) => b.lignes.length - a.lignes.length || a.nom.localeCompare(b.nom, 'fr'));
    }, [liste, vueCourante.groupe]);

    if (commandes.length === 0) {
        return (
            <AppLayout title="Commandes servies" subtitle={SOUS_TITRE}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-gray-700 px-4 py-16 text-center">
                    <IconInbox className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">
                        Aucune commande servie pour le moment.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                        Les commandes apparaissent ici dès que la totalité de la quantité demandée a été servie.
                    </p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="Commandes servies" subtitle={SOUS_TITRE}>
            {/* Onglets, avec le compteur de chacun */}
            <div className="flex flex-wrap gap-1.5 mb-5 border-b border-gray-200 dark:border-gray-800">
                {VUES.map((v) => (
                    <button
                        key={v.cle}
                        type="button"
                        onClick={() => setVue(v.cle)}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                            vue === v.cle
                                ? 'border-[#0d2b52] text-[#0d2b52] dark:border-blue-400 dark:text-blue-300'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {v.libelle}
                        <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
                            ({parVue[v.cle]?.length ?? 0})
                        </span>
                    </button>
                ))}
            </div>

            {liste.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-10 text-center">
                    Aucune commande servie dans cette catégorie.
                </p>
            ) : groupes ? (
                <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {groupes.length} groupe{groupes.length > 1 ? 's' : ''} · regroupement par{' '}
                        <strong>{vueCourante.libelleGroupe}</strong>
                    </p>

                    {groupes.map((g) => {
                        const cle = `${vue}:${g.nom}`;
                        const ouvert = repliés[cle] !== true;

                        return (
                            <section
                                key={cle}
                                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                <button
                                    type="button"
                                    onClick={() => setRepliés((r) => ({ ...r, [cle]: ouvert }))}
                                    className="w-full flex items-center gap-2.5 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                                >
                                    <IconChevronRight
                                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                                            ouvert ? 'rotate-90' : ''
                                        }`}
                                    />
                                    <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                                        {g.nom}
                                    </span>
                                    <span className="ml-auto shrink-0 text-xs font-semibold text-[#0d2b52] dark:text-blue-300 bg-[#0d2b52]/[0.07] dark:bg-blue-400/10 rounded-full px-2.5 py-1">
                                        {g.lignes.length} commande{g.lignes.length > 1 ? 's' : ''}
                                    </span>
                                </button>

                                {ouvert && (
                                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100 dark:border-gray-800">
                                        {g.lignes.map((c) => (
                                            <CarteCommande
                                                key={c.id}
                                                c={c}
                                                reactiver={reactiver}
                                                annulerService={annulerService}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-4">
                    {liste.map((c) => (
                        <CarteCommande key={c.id} c={c} reactiver={reactiver} annulerService={annulerService} />
                    ))}
                </div>
            )}
        </AppLayout>
    );
}

/** Une commande servie : son article, son historique de sorties, et les deux retours en arrière. */
function CarteCommande({ c, reactiver, annulerService }) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={`/stock-production/articles/${encodeURIComponent(c.Article || '')}`}
                            prefetch="hover"
                            className="font-mono font-bold text-[#0d2b52] dark:text-blue-300 hover:underline"
                        >
                            {c.Article || '(sans article)'}
                        </Link>
                        {c.Job && <BadgeJob job={c.Job} />}
                        {c.Qte_demandee && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Quantité demandée : <span className="font-semibold">{c.Qte_demandee}</span>
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{c.Designation || '—'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {c.Emetteur || 'émetteur inconnu'}
                        {c.Date_mail ? ` · mail du ${String(c.Date_mail).slice(0, 10)}` : ''}
                    </p>
                    {c.Objet && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate" title={c.Objet}>
                            Objet : {c.Objet}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => reactiver(c.id)}
                    title="Remettre cette commande dans la vue active (l'historique est conservé)"
                    className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                >
                    <IconRestore className="h-3.5 w-3.5" /> Remettre en cours
                </button>
            </div>

            {c.services.length > 0 && (
                <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                        Historique des sorties de stock
                    </p>
                    <ul className="space-y-1.5">
                        {c.services.map((s) => (
                            <li
                                key={s.id}
                                className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                            >
                                <span className="font-semibold text-gray-900 dark:text-gray-200 tabular-nums">
                                    {s.quantite}
                                </span>
                                <span>servi(s) le {dateService(s.date)}</span>
                                {s.servi_par && <span className="text-gray-400">par {s.servi_par}</span>}
                                <button
                                    type="button"
                                    onClick={() => annulerService(s.id)}
                                    title="Annuler cette sortie : la quantité est restituée au stock"
                                    className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                                >
                                    Annuler cette sortie
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
