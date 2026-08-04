import { Fragment, useState } from 'react';
import { Link } from '@inertiajs/react';
import AppLayout from '../Layouts/AppLayout';
import BadgeJob from '../Components/BadgeJob';
import { IconChevronLeft, IconInbox } from '../Components/Icons';
import { trouverColonne } from '../utils/colonnesStock';

const ONGLETS = [
    { key: 'infos', label: 'Infos générales' },
    { key: 'emplacements', label: 'Emplacements' },
    { key: 'commandes', label: 'Commandes liées' },
    { key: 'mouvements', label: 'Mouvements par heure' },
];

export default function StockArticleDetail({
    idImport,
    article,
    nomFichier,
    titreStock,
    colonnes,
    colonneArticleKey,
    lignes,
    commandesLiees = [],
    nonTrouveEnStock = false,
    qteServie = 0,
    mouvementsParHeure = [],
    mouvementsDetail = [],
    stockDerniereDate = null,
}) {
    const [ongletActif, setOngletActif] = useState('infos');

    const colonneDesignation = trouverColonne(colonnes, 'designation');
    const colonneQte = trouverColonne(colonnes, 'qte') || trouverColonne(colonnes, 'quantite');

    const designation = colonneDesignation ? lignes[0]?.[colonneDesignation.key] : null;
    // Article absent du dernier import de stock -> quantité 0 explicite (pas
    // "on ne sait pas") : c'est un cas courant, pas une erreur.
    // Quantité brute du fichier importé (jamais modifiée).
    const quantiteFichier = nonTrouveEnStock
        ? 0
        : colonneQte
            ? lignes.reduce((total, ligne) => total + (Number(ligne[colonneQte.key]) || 0), 0)
            : null;

    // Quantité affichée = stock À LA DERNIÈRE DATE CONNUE.
    //
    // La quantité du fichier de stock est une photo : elle est périmée dès
    // qu'un mouvement a eu lieu. On lui ajoute donc les entrées/sorties
    // enregistrées depuis (stockDerniereDate), puis on retire ce qui a déjà
    // été servi depuis la page Analyse — même calcul que là-bas, sinon les
    // deux pages afficheraient des chiffres différents.
    const baseStock = stockDerniereDate ? stockDerniereDate.stock : quantiteFichier;
    const quantiteTotale = baseStock === null ? null : baseStock - qteServie;

    const formaterInstantCourt = (iso) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const nombre = (v) =>
        v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);

    // Colonnes affichées dans l'onglet "Emplacements" : tout sauf le code article (déjà dans le titre).
    const colonnesEmplacements = colonnes.filter((c) => c.key !== colonneArticleKey);

    // "Détails" (infos générales) ne doit montrer que les infos identiques sur
    // TOUS les emplacements (ex: désignation) — pas une valeur d'un seul
    // emplacement (ex: quantité, statut) présentée comme si elle concernait
    // tout l'article.
    const colonnesCommunes = colonnesEmplacements.filter((col) => {
        const premiere = lignes[0]?.[col.key] ?? '';
        return lignes.every((ligne) => (ligne[col.key] ?? '') === premiere);
    });

    return (
        <AppLayout title={`Article ${article}`} subtitle={designation || undefined}>
            <Link
                href={idImport ? `/stock-production?import=${idImport}` : '/stock-production'}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline mb-5"
            >
                <IconChevronLeft className="h-4 w-4" /> Retour à Stock / Production
            </Link>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5 mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Article</p>
                <p className="text-2xl font-extrabold text-[#0d2b52] dark:text-white mt-1">{article}</p>
                {designation && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{designation}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
                    {nonTrouveEnStock
                        ? "Absent du dernier import de stock -- quantité considérée comme 0."
                        : `Source : ${nomFichier} ${titreStock ? `· ${titreStock}` : ''}`}
                </p>
            </div>

            {/* Onglets */}
            <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-800">
                {ONGLETS.map((onglet) => (
                    <button
                        key={onglet.key}
                        onClick={() => setOngletActif(onglet.key)}
                        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                            ongletActif === onglet.key
                                ? 'border-[#0d2b52] text-[#0d2b52] dark:border-blue-400 dark:text-blue-300'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {onglet.label}
                        {onglet.key === 'commandes' && commandesLiees.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">({commandesLiees.length})</span>
                        )}
                        {onglet.key === 'mouvements' && mouvementsDetail.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
                                ({mouvementsDetail.length})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Onglet : Infos générales */}
            {ongletActif === 'infos' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Emplacements</p>
                        <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{lignes.length}</p>
                    </div>
                    {quantiteTotale !== null && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm sm:col-span-2">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                {stockDerniereDate ? 'Stock à la dernière date connue' : 'Quantité totale'}
                            </p>
                            <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">
                                {nombre(quantiteTotale)}
                            </p>

                            {/* Décomposition : le chiffre affiché ne doit jamais
                                sortir de nulle part. */}
                            {stockDerniereDate ? (
                                <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                                    <p className="tabular-nums">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                                            {nombre(stockDerniereDate.reference)}
                                        </span>{' '}
                                        au fichier de stock du{' '}
                                        {formaterInstantCourt(stockDerniereDate.instantReference)}
                                    </p>
                                    {stockDerniereDate.nombreMouvements > 0 && (
                                        <p className="tabular-nums">
                                            <span
                                                className={`font-semibold ${
                                                    stockDerniereDate.variation < 0
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : 'text-emerald-600 dark:text-emerald-400'
                                                }`}
                                            >
                                                {stockDerniereDate.variation > 0 ? '+' : ''}
                                                {nombre(stockDerniereDate.variation)}
                                            </span>{' '}
                                            de mouvements ({stockDerniereDate.nombreMouvements}) jusqu'au{' '}
                                            {formaterInstantCourt(stockDerniereDate.derniereDate)}
                                        </p>
                                    )}
                                    {qteServie > 0 && (
                                        <p className="tabular-nums">
                                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                −{nombre(qteServie)}
                                            </span>{' '}
                                            déjà servi(s) depuis la page Analyse
                                        </p>
                                    )}
                                    {stockDerniereDate.nombreMouvements === 0 && (
                                        <p>Aucun mouvement depuis cette date : le stock n'a pas bougé.</p>
                                    )}
                                </div>
                            ) : (
                                qteServie > 0 && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                        {nombre(quantiteFichier)} au fichier − {nombre(qteServie)} déjà servi(s)
                                    </p>
                                )
                            )}
                        </div>
                    )}
                    {colonnesCommunes.length > 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm sm:col-span-3">
                            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Détails</p>
                            <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">
                                Informations identiques sur tous les emplacements. Le détail par emplacement est dans l'onglet "Emplacements".
                            </p>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                {colonnesCommunes.map((col) => (
                                    <div key={col.key} className="flex justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                                        <dt className="text-gray-500 dark:text-gray-400">{col.label}</dt>
                                        <dd className="text-gray-900 dark:text-gray-200 font-semibold text-right truncate">
                                            {lignes[0]?.[col.key] || '—'}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
            )}

            {/* Onglet : Emplacements */}
            {ongletActif === 'emplacements' && (
                nonTrouveEnStock ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-gray-700 px-4 py-16 text-center">
                        <IconInbox className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                        <p className="text-gray-500 dark:text-gray-400 font-semibold">Aucun emplacement -- article absent du stock actuel.</p>
                    </div>
                ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                    {colonnesEmplacements.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                                                col.numeric ? 'text-right' : 'text-left'
                                            }`}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lignes.map((ligne, index) => (
                                    <tr
                                        key={ligne._id ?? index}
                                        className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/60 dark:hover:bg-gray-800/60 transition-colors ${
                                            index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                        }`}
                                    >
                                        {colonnesEmplacements.map((col) => (
                                            <td
                                                key={col.key}
                                                className={`px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200 ${
                                                    col.numeric ? 'text-right tabular-nums' : ''
                                                }`}
                                            >
                                                {ligne[col.key] === '' || ligne[col.key] == null ? '—' : String(ligne[col.key])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                )
            )}

            {/* Onglet : Commandes liées (même Article, rapprochement par nom -- voir StockController::article()) */}
            {ongletActif === 'commandes' && (
                commandesLiees.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-dashed border-gray-300 dark:border-gray-700 px-4 py-16 text-center">
                        <IconInbox className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                        <p className="text-gray-500 dark:text-gray-400 font-semibold">Aucune commande liée à cet article.</p>
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Aucune commande en base ne porte sur l'article "{article}".</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="text-left text-gray-500 dark:text-gray-400">
                                        {['Date mail', 'Émetteur', 'Job', 'Désignation', 'Qté demandée', 'Destination', 'Urgent'].map((label) => (
                                            <th
                                                key={label}
                                                className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {commandesLiees.map((c, index) => (
                                        <tr
                                            key={c.id}
                                            className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/60 dark:hover:bg-gray-800/60 transition-colors ${
                                                index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                            }`}
                                        >
                                            <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200">{c.Date_mail || '—'}</td>
                                            <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200">{c.Emetteur || '—'}</td>
                                            <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800">{c.Job ? <BadgeJob job={c.Job} /> : '—'}</td>
                                            <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200">{c.Designation || '—'}</td>
                                            <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200 text-right tabular-nums">{c.Qte_demandee ?? '—'}</td>
                                            <td className="px-4 py-2.5 border-r border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-200">{c.Destination || '—'}</td>
                                            <td className="px-4 py-2.5 text-gray-900 dark:text-gray-200">{c.Urgent === 'OUI' ? 'Oui' : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* Onglet : Mouvements par heure */}
            {ongletActif === 'mouvements' && (
                <MouvementsParHeure parHeure={mouvementsParHeure} detail={mouvementsDetail} />
            )}
        </AppLayout>
    );
}

/* ==================================================================
   Mouvements de stock de l'article, regroupés par heure.

   Le fichier ERP enregistre chaque sortie à la minute près : sur un article
   très mouvementé, la liste brute est illisible. Le regroupement horaire
   montre le rythme réel (quelles heures de la journée bougent), et le détail
   ligne à ligne reste accessible juste en dessous.
   ================================================================== */

function MouvementsParHeure({ parHeure, detail }) {
    const [heureOuverte, setHeureOuverte] = useState(null);

    if (!parHeure.length) {
        return (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
                <IconInbox className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Aucun mouvement de stock pour cet article.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Importe le fichier « Mouvements de stock » depuis la page Stock historique.
                </p>
            </div>
        );
    }

    const nombre = (v, d = 2) =>
        v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(v);

    const libelleHeure = (h) => {
        const d = new Date(h.replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return h;
        const jour = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${jour} à ${String(d.getHours()).padStart(2, '0')} h`;
    };

    // Totaux sur toute la période couverte par le fichier.
    const totalEntrees = parHeure.reduce((s, l) => s + l.entrees, 0);
    const totalSorties = parHeure.reduce((s, l) => s + l.sorties, 0);
    const amplitudeMax = Math.max(...parHeure.map((l) => Math.abs(l.variation)), 1);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
                {[
                    { libelle: 'Heures avec activité', valeur: nombre(parHeure.length, 0) },
                    { libelle: 'Mouvements', valeur: nombre(detail.length, 0) },
                    { libelle: 'Total entrées', valeur: `+${nombre(totalEntrees)}`, couleur: 'text-emerald-600 dark:text-emerald-400' },
                    { libelle: 'Total sorties', valeur: nombre(totalSorties), couleur: 'text-rose-600 dark:text-rose-400' },
                ].map((c) => (
                    <div
                        key={c.libelle}
                        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
                    >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {c.libelle}
                        </p>
                        <p className={`mt-1 text-2xl font-bold tabular-nums ${c.couleur ?? 'text-gray-800 dark:text-gray-100'}`}>
                            {c.valeur}
                        </p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Activité heure par heure</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Clique sur une heure pour voir les mouvements qu'elle contient.
                    </p>
                </div>

                <div className="max-h-[520px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                <th className="px-4 py-2.5">Heure</th>
                                <th className="px-4 py-2.5 text-right">Entrées</th>
                                <th className="px-4 py-2.5 text-right">Sorties</th>
                                <th className="px-4 py-2.5 text-right">Net</th>
                                <th className="px-4 py-2.5 w-40">Amplitude</th>
                                <th className="px-4 py-2.5 text-right">Mvts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {parHeure.map((l) => {
                                const ouverte = heureOuverte === l.heure;
                                const lignesDeLHeure = ouverte
                                    ? detail.filter((m) => m.instant.slice(0, 13) === l.heure.slice(0, 13).replace(' ', 'T'))
                                    : [];

                                return (
                                    <Fragment key={l.heure}>
                                        <tr
                                            onClick={() => setHeureOuverte(ouverte ? null : l.heure)}
                                            className={`cursor-pointer transition-colors ${
                                                ouverte
                                                    ? 'bg-blue-50 dark:bg-gray-800'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                                            }`}
                                        >
                                            <td className="px-4 py-2 text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap">
                                                {libelleHeure(l.heure)}
                                            </td>
                                            <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                                {l.entrees > 0 ? `+${nombre(l.entrees)}` : '—'}
                                            </td>
                                            <td className="px-4 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                                                {l.sorties < 0 ? nombre(l.sorties) : '—'}
                                            </td>
                                            <td
                                                className={`px-4 py-2 text-right font-semibold tabular-nums ${
                                                    l.variation < 0
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : l.variation > 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-gray-400'
                                                }`}
                                            >
                                                {l.variation > 0 ? '+' : ''}
                                                {nombre(l.variation)}
                                            </td>
                                            {/* Barre proportionnelle : repère visuel du poids de l'heure */}
                                            <td className="px-4 py-2">
                                                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            l.variation < 0 ? 'bg-rose-400' : 'bg-emerald-400'
                                                        }`}
                                                        style={{
                                                            width: `${Math.max(3, (Math.abs(l.variation) / amplitudeMax) * 100)}%`,
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                                                {l.nombre}
                                            </td>
                                        </tr>

                                        {ouverte && (
                                            <tr className="bg-blue-50/50 dark:bg-gray-800/50">
                                                <td colSpan={6} className="px-4 py-3">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-left text-gray-500 dark:text-gray-400">
                                                                <th className="pb-1.5 font-semibold">Heure exacte</th>
                                                                <th className="pb-1.5 font-semibold">Transaction</th>
                                                                <th className="pb-1.5 font-semibold">Pièce origine</th>
                                                                <th className="pb-1.5 font-semibold">Emplacement</th>
                                                                <th className="pb-1.5 font-semibold text-right">Quantité</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {lignesDeLHeure.map((m, i) => (
                                                                <tr key={i} className="text-gray-700 dark:text-gray-300">
                                                                    <td className="py-1 tabular-nums">
                                                                        {new Date(m.instant).toLocaleTimeString('fr-FR', {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </td>
                                                                    <td className="py-1">{m.transaction ?? '—'}</td>
                                                                    <td className="py-1 font-mono">{m.piece ?? '—'}</td>
                                                                    <td className="py-1 font-mono">{m.emplacement ?? '—'}</td>
                                                                    <td
                                                                        className={`py-1 text-right font-semibold tabular-nums ${
                                                                            m.quantite < 0
                                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                                : 'text-emerald-600 dark:text-emerald-400'
                                                                        }`}
                                                                    >
                                                                        {m.quantite > 0 ? '+' : ''}
                                                                        {nombre(m.quantite)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
