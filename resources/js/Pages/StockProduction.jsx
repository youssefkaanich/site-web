import { useState } from 'react';
import * as XLSX from 'xlsx';
import AppLayout from '../Layouts/AppLayout';
import { useResizableColumns } from '../hooks/useResizableColumns';

const LARGEUR_COLONNE = 150;

function estNumerique(valeurs) {
    const remplies = valeurs.filter((v) => v !== '' && v !== null && v !== undefined);
    if (remplies.length === 0) return false;
    return remplies.every((v) => typeof v === 'number' || !isNaN(Number(v)));
}

function analyserFichier(fichier, onSuccess, onError) {
    const lecteur = new FileReader();

    lecteur.onload = (e) => {
        try {
            const classeur = XLSX.read(e.target.result, { type: 'array' });
            const nomFeuille = classeur.SheetNames[0];
            const feuille = classeur.Sheets[nomFeuille];
            const lignesBrutes = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '' });

            if (lignesBrutes.length === 0) {
                onError('Ce fichier ne contient aucune donnée.');
                return;
            }

            const entetes = lignesBrutes[0].map((e, i) => String(e || `Colonne ${i + 1}`));
            const lignesDonnees = lignesBrutes.slice(1).filter((ligne) => ligne.some((v) => v !== ''));

            const colonnes = entetes.map((label, i) => ({
                key: `col_${i}`,
                label,
                numeric: estNumerique(lignesDonnees.map((l) => l[i])),
            }));

            const lignes = lignesDonnees.map((ligne, index) => {
                const objet = { _id: index };
                colonnes.forEach((col, i) => {
                    objet[col.key] = ligne[i] ?? '';
                });
                return objet;
            });

            onSuccess({ nomFeuille, colonnes, lignes });
        } catch (err) {
            onError("Impossible de lire ce fichier. Vérifie que c'est bien un fichier Excel (.xlsx, .xls) valide.");
        }
    };

    lecteur.onerror = () => onError('Erreur de lecture du fichier.');
    lecteur.readAsArrayBuffer(fichier);
}

export default function StockProduction() {
    const [nomFichier, setNomFichier] = useState(null);
    const [colonnes, setColonnes] = useState([]);
    const [lignes, setLignes] = useState([]);
    const [erreur, setErreur] = useState(null);
    const [widths, startResize, colonneActive] = useResizableColumns({});

    function importerFichier(e) {
        const fichier = e.target.files[0];
        e.target.value = ''; // permet de réimporter le même fichier ensuite
        if (!fichier) return;

        setErreur(null);
        analyserFichier(
            fichier,
            ({ colonnes: nvColonnes, lignes: nvLignes }) => {
                setNomFichier(fichier.name);
                setColonnes(nvColonnes);
                setLignes(nvLignes);
            },
            (message) => setErreur(message)
        );
    }

    function reinitialiser() {
        setNomFichier(null);
        setColonnes([]);
        setLignes([]);
        setErreur(null);
    }

    return (
        <AppLayout
            title="Stock / Production"
            subtitle="Importe un fichier Excel pour visualiser son contenu dans un tableau, sans rien enregistrer sur le serveur."
        >
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <label className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0d2b52] hover:bg-[#0d2b52]/90 cursor-pointer">
                    📂 Importer un fichier Excel
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={importerFichier} className="hidden" />
                </label>
                {nomFichier && (
                    <>
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg">
                            📄 {nomFichier}
                        </span>
                        <button
                            onClick={reinitialiser}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                            × Retirer le fichier
                        </button>
                    </>
                )}
            </div>

            {erreur && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
                    ⚠️ {erreur}
                </div>
            )}

            {nomFichier && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Lignes</p>
                        <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{lignes.length}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Colonnes</p>
                        <p className="text-4xl font-extrabold mt-2 text-[#0d2b52] dark:text-white">{colonnes.length}</p>
                    </div>
                </div>
            )}

            {!nomFichier && !erreur && (
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-16 text-center text-gray-400 dark:text-gray-600">
                    Importe un fichier Excel pour voir son contenu ici.
                </div>
            )}

            {nomFichier && (
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed border-collapse">
                            <colgroup>
                                {colonnes.map((col) => (
                                    <col key={col.key} style={{ width: widths[col.key] ?? LARGEUR_COLONNE }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400">
                                    {colonnes.map((col) => (
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
                                {lignes.map((ligne, index) => (
                                    <tr
                                        key={ligne._id}
                                        className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/60 dark:hover:bg-gray-800/60 transition-colors ${
                                            index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-900'
                                        }`}
                                    >
                                        {colonnes.map((col) => (
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
                                {lignes.length === 0 && (
                                    <tr>
                                        <td colSpan={colonnes.length} className="px-4 py-8 text-center text-gray-400 dark:text-gray-600">
                                            Ce fichier n'a pas de lignes de données (juste des en-têtes).
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
