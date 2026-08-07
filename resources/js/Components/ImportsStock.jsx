import { useState } from 'react';
import axios from 'axios';
import { router, Link } from '@inertiajs/react';
import {
    IconFolder,
    IconClock,
    IconCheck,
    IconAlertTriangle,
    IconTrash,
} from './Icons';

/**
 * Message d'erreur d'import, aussi precis que possible.
 *
 * Le cas le plus fréquent — un fichier trop volumineux — ne produit AUCUN
 * message du serveur : PHP jette la requête entière avant que Laravel la
 * voie (post_max_size). Sans ce traitement, l'utilisateur ne voyait qu'un
 * « L'import a échoué. » sans aucune piste.
 */
function messageErreur(e, fichier) {
    const precis = e.response?.data?.erreur;
    if (precis) return precis;

    const taille = fichier ? ` (${(fichier.size / 1048576).toFixed(1)} Mo)` : '';

    if (e.response?.status === 413 || !e.response) {
        return `Le fichier${taille} est trop volumineux pour être envoyé, ou la connexion a été interrompue. `
            + `La limite du serveur est de 128 Mo.`;
    }
    if (e.response.status === 422) {
        return `Fichier refusé${taille} : vérifie qu'il s'agit bien d'un .xls ou .xlsx.`;
    }
    if (e.response.status >= 500) {
        return `Le serveur a rencontré une erreur en traitant le fichier${taille}. `
            + `Regarde storage/logs/laravel.log pour le détail.`;
    }
    return `L'import a échoué${taille} (code ${e.response.status}).`;
}

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


/**
 * Récapitulatif des lignes écartées à l'import, avec leur motif.
 *
 * Affiché systématiquement : un écart entre le nombre de lignes du fichier et
 * le nombre de mouvements retenus doit toujours être explicable, sinon
 * l'utilisateur soupçonne une perte de données.
 */
function LignesEcartees({ ignores, lues }) {
    if (!ignores) return null;

    const motifs = [
        { cle: 'article', valeur: ignores.article, texte: 'matières premières et composants (5ᵉ caractère du code ni A ni B)' },
        { cle: 'statut', valeur: ignores.statut, texte: 'statut Q (qualité) ou R (rebut, retours)' },
        { cle: 'date', valeur: ignores.date, texte: 'date ou heure illisible' },
        { cle: 'quantite', valeur: ignores.quantite, texte: 'quantité absente' },
    ].filter((m) => m.valeur > 0);

    if (!motifs.length) {
        return (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                Toutes les lignes du fichier ont été retenues.
            </p>
        );
    }

    const total = motifs.reduce((s, m) => s + m.valeur, 0);

    return (
        <details className="mt-2">
            <summary className="text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                {formaterNombre(total, 0)} lignes écartées sur {formaterNombre(lues, 0)} — voir le détail
            </summary>
            <ul className="mt-1.5 ml-1 space-y-0.5">
                {motifs.map((m) => (
                    <li key={m.cle} className="text-[11px] text-slate-500 dark:text-slate-400 flex gap-2">
                        <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                            {formaterNombre(m.valeur, 0)}
                        </span>
                        <span>{m.texte}</span>
                    </li>
                ))}
            </ul>
        </details>
    );
}


/**
 * Bouton d'import de fichier Excel, partagé par les deux cartes.
 *
 * `occupe` est l'identifiant du fichier en cours d'import (ou null) : il
 * désactive les DEUX boutons pendant un import, pour éviter de lancer les deux
 * traitements en même temps.
 */
function BoutonImport({ cle, libelle, occupe, onFichier }) {
    const enCours = occupe === cle;
    const bloque = occupe !== null;

    return (
        <label
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 cursor-pointer inline-flex items-center gap-2 transition-all ${
                bloque ? 'opacity-60 pointer-events-none' : ''
            }`}
        >
            {enCours ? (
                <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Lecture du fichier…
                </>
            ) : (
                <>
                    <IconFolder className="h-4 w-4" /> {libelle}
                </>
            )}
            <input
                type="file"
                accept=".xlsx,.xls"
                onChange={onFichier}
                disabled={bloque}
                className="hidden"
            />
        </label>
    );
}

/**
 * Import des deux fichiers Excel du stock, affiché dans la page
 * Stock / Production.
 *
 * Une page dédiée n'aurait porté que ces deux boutons : import et
 * consultation vivent donc au même endroit.
 */
export default function ImportsStock({ pret, erreur, reference, mouvements, importsMouvements }) {
    const [erreurImport, setErreurImport] = useState(null);
    // Identifiant du fichier en cours d'import ('stock' | 'mouvements' | null).
    const [importEnCours, setImportEnCours] = useState(null);
    const [dernierImport, setDernierImport] = useState(null);
    const [messageStock, setMessageStock] = useState(null);

    /**
     * Envoi d'un fichier Excel.
     *
     * Le fichier de stock passe par la route EXISTANTE de Stock / Production :
     * même nettoyage (basestock.py), même filtre produits finis, même
     * historique. Importer depuis ici ou depuis là-bas revient exactement au
     * même — c'est le même import, juste un second point d'entrée.
     */
    function envoyer(evenement, cle, url, surSucces) {
        const fichier = evenement.target.files?.[0];
        if (!fichier) return;

        setImportEnCours(cle);
        setErreurImport(null);
        setDernierImport(null);
        setMessageStock(null);

        const donnees = new FormData();
        donnees.append('fichier', fichier);

        axios
            .post(url, donnees)
            .then(({ data }) => {
                surSucces(data);
                router.reload();
            })
            .catch((e) => setErreurImport(messageErreur(e, fichier)))
            .finally(() => {
                setImportEnCours(null);
                evenement.target.value = '';
            });
    }

    const importerStock = (e) =>
        envoyer(e, 'stock', '/stock-production/importer', (data) =>
            setMessageStock(
                `Fichier de stock importé : ${formaterNombre(data.lignes?.length ?? 0, 0)} lignes de produits finis retenues.`
            )
        );

    const importerMouvements = (e) =>
        envoyer(e, 'mouvements', '/stock-historique/importer', setDernierImport);

    function supprimerImport(id) {
        axios.delete(`/stock-historique/imports/${id}`).then(() => router.reload());
    }

    return (
        <div>
            {/* ---------- Les deux fichiers ---------- */}
            <div className="grid gap-4 md:grid-cols-2 mb-6">
                {/* Fichier 1 : stock de référence */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0d2b52] text-white text-[11px] font-bold">
                            1
                        </span>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Stock de référence</h2>
                    </div>

                    {reference ? (
                        <>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate" title={reference.nomFichier}>
                                {reference.nomFichier}
                            </p>
                            {/* Confirmation visuelle demandée : la date lue dans l'en-tête */}
                            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
                                <IconCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <div className="text-sm">
                                    <span className="text-emerald-800 dark:text-emerald-200">Date de référence détectée : </span>
                                    <strong className="text-emerald-900 dark:text-emerald-100 tabular-nums">
                                        {formaterInstant(reference.instant)}
                                    </strong>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                {formaterNombre(reference.nombreArticles, 0)} articles · agrégés en additionnant tous les
                                emplacements de chaque article
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Aucun fichier de stock importé. C'est la photo du stock à un instant donné (export
                            <span className="font-mono text-xs"> INVLISTELOCALL</span>), point de départ du calcul.
                        </p>
                    )}

                    <div className="mt-3">
                        <BoutonImport
                            cle="stock"
                            libelle={reference ? 'Remplacer le fichier de stock' : 'Importer le stock'}
                            occupe={importEnCours}
                            onFichier={importerStock}
                        />
                    </div>

                    {messageStock && (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{messageStock}</p>
                    )}
                </div>

                {/* Fichier 2 : mouvements */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0d2b52] text-white text-[11px] font-bold">
                            2
                        </span>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Mouvements de stock</h2>
                    </div>

                    {mouvements ? (
                        <>
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate" title={mouvements.nomFichier}>
                                {mouvements.nomFichier}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                {formaterNombre(mouvements.nombreMouvements, 0)} mouvements ·{' '}
                                {formaterNombre(mouvements.nombreArticles, 0)} articles
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                du {formaterInstant(new Date(mouvements.debut * 1000).toISOString())} au{' '}
                                {formaterInstant(new Date(mouvements.fin * 1000).toISOString())}
                            </p>
                            <LignesEcartees ignores={mouvements.ignores} lues={mouvements.lues} />
                        </>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Aucun fichier de mouvements importé. Ce sont les entrées et sorties qui ont suivi la photo
                            de stock (export <span className="font-mono text-xs">MVTSTOTRSVCR</span>).
                        </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <BoutonImport
                            cle="mouvements"
                            libelle={mouvements ? 'Remplacer les mouvements' : 'Importer les mouvements'}
                            occupe={importEnCours}
                            onFichier={importerMouvements}
                        />
                        {importEnCours === 'mouvements' && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Les gros fichiers (~185 000 lignes) prennent une dizaine de secondes.
                            </span>
                        )}
                    </div>

                    {importsMouvements?.length > 1 && (
                        <details className="mt-3">
                            <summary className="text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                                Imports précédents ({importsMouvements.length})
                            </summary>
                            <ul className="mt-2 space-y-1">
                                {importsMouvements.map((i) => {
                                    const actif = i.id === mouvements?.id;
                                    return (
                                        <li key={i.id} className="flex items-center gap-2 text-xs">
                                            <IconClock className="h-3 w-3 text-slate-400 shrink-0" />
                                            <Link
                                                href={`/stock-historique?mouvements=${i.id}`}
                                                preserveScroll
                                                className={`flex-1 truncate hover:underline ${
                                                    actif
                                                        ? 'font-semibold text-[#0d2b52] dark:text-blue-300'
                                                        : 'text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                {i.nomFichier} — {formaterNombre(i.nombreMouvements, 0)} mvts
                                                {i.fin &&
                                                    ` (jusqu'au ${new Date(i.fin * 1000).toLocaleDateString('fr-FR')})`}
                                            </Link>
                                            {actif && (
                                                <span className="shrink-0 rounded-full bg-[#0d2b52] px-2 py-0.5 text-[10px] font-semibold text-white">
                                                    utilisé
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => supprimerImport(i.id)}
                                                className="text-slate-400 hover:text-rose-600"
                                                title="Supprimer cet import"
                                            >
                                                <IconTrash className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </details>
                    )}
                </div>
            </div>

            {erreurImport && (
                <div className="mb-4">
                    <Alerte message={erreurImport} />
                </div>
            )}

            {dernierImport && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                    <IconCheck className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                        Import réussi : {formaterNombre(dernierImport.nombreMouvements, 0)} mouvements retenus sur{' '}
                        {formaterNombre(dernierImport.lues, 0)} lignes lues.
                    </span>
                </div>
            )}

            {!pret && <Alerte message={erreur} />}
        </div>
    );
}
