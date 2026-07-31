import { useEffect, useRef, useState } from 'react';
import { IconFiltre } from './Icons';

/**
 * En-tête de colonne filtrable : le libellé, puis une icône entonnoir qui
 * ouvre la liste des valeurs présentes (case à cocher + nombre de lignes).
 *
 * Utilisé dans le tableau des commandes (Gestion.jsx) et dans le suivi de la
 * page Analyse — d'où la mise en commun, pour que les deux se comportent
 * exactement pareil.
 *
 * @param label     Libellé de la colonne (ex: "Émetteur")
 * @param valeurs   [{ valeur, nombre }] — à calculer AVANT d'appliquer le
 *                  filtre, sinon la liste se réduit à mesure qu'on coche et
 *                  il devient impossible de décocher.
 * @param selection Valeurs cochées ([] = aucun filtre, tout est affiché)
 * @param onChange  Reçoit la nouvelle sélection
 */
export default function FiltreColonne({ label, valeurs, selection, onChange }) {
    const [ouvert, setOuvert] = useState(false);
    const conteneurRef = useRef(null);
    const boutonRef = useRef(null);
    // Position fixe : l'en-tête est tronqué (truncate) et le tableau défile
    // (overflow-auto) -- un menu en position absolue y serait coupé. On calcule
    // donc sa position à l'ouverture.
    const [position, setPosition] = useState({ top: 0, left: 0 });

    function basculerMenu() {
        const rect = boutonRef.current?.getBoundingClientRect();
        if (rect) {
            setPosition({
                top: rect.bottom + 6,
                // Recale le menu s'il dépasserait le bord droit de la fenêtre.
                left: Math.min(rect.left, window.innerWidth - 252),
            });
        }
        setOuvert((v) => !v);
    }

    // Ferme au clic en dehors, sur Échap, ou au défilement (sinon le menu, en
    // position fixe, resterait figé loin de son en-tête).
    useEffect(() => {
        if (!ouvert) return;

        function auClic(e) {
            if (conteneurRef.current && !conteneurRef.current.contains(e.target)) setOuvert(false);
        }
        function auClavier(e) {
            if (e.key === 'Escape') setOuvert(false);
        }
        function auDefilement() {
            setOuvert(false);
        }

        document.addEventListener('mousedown', auClic);
        document.addEventListener('keydown', auClavier);
        document.addEventListener('scroll', auDefilement, true); // capture : aussi le scroll du tableau
        return () => {
            document.removeEventListener('mousedown', auClic);
            document.removeEventListener('keydown', auClavier);
            document.removeEventListener('scroll', auDefilement, true);
        };
    }, [ouvert]);

    const actif = selection.length > 0;
    const toutCoche = valeurs.length > 0 && selection.length === valeurs.length;

    function basculerUne(valeur) {
        onChange(
            selection.includes(valeur) ? selection.filter((v) => v !== valeur) : [...selection, valeur]
        );
    }

    return (
        // Toute la cellule est cliquable (pas seulement l'icône) : c'est la
        // zone la plus naturelle à viser. Le ref englobe aussi le menu, sinon
        // un clic sur le libellé serait vu comme "en dehors" et le menu se
        // fermerait puis se rouvrirait aussitôt.
        <span
            ref={conteneurRef}
            role="button"
            tabIndex={0}
            onClick={basculerMenu}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    basculerMenu();
                }
            }}
            title={actif ? `${selection.length} valeur(s) sélectionnée(s)` : `Filtrer par ${label.toLowerCase()}`}
            className="group flex items-center gap-1.5 w-full cursor-pointer select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-[#0d2b52]/30"
        >
            <span className="truncate">
                {label}
                {actif && ` (${selection.length})`}
            </span>

            <span className="shrink-0" ref={boutonRef}>
                <span
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                        actif
                            ? 'text-[#0d2b52] bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50'
                            : 'text-gray-400 group-hover:text-gray-700 group-hover:bg-gray-200/70 dark:group-hover:text-gray-200 dark:group-hover:bg-gray-700'
                    }`}
                >
                    <IconFiltre className="h-3.5 w-3.5" />
                </span>

                {ouvert && (
                    <div
                        // Sans ça, cocher une case remonterait jusqu'à l'en-tête
                        // cliquable et refermerait le menu aussitôt.
                        onClick={(e) => e.stopPropagation()}
                        style={{ top: position.top, left: position.left }}
                        className="fixed z-[120] w-60 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg normal-case tracking-normal cursor-default font-normal"
                    >
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={() => onChange(toutCoche ? [] : valeurs.map((v) => v.valeur))}
                                className="text-xs font-semibold text-[#0d2b52] dark:text-blue-300 hover:underline"
                            >
                                {toutCoche ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                            <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">
                                {valeurs.length}
                            </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto py-1">
                            {valeurs.map((v) => (
                                <label
                                    key={v.valeur}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-normal text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selection.includes(v.valeur)}
                                        onChange={() => basculerUne(v.valeur)}
                                        className="rounded border-gray-300 dark:border-gray-600 text-[#0d2b52] focus:ring-[#0d2b52]/30"
                                    />
                                    <span className="flex-1 truncate" title={v.valeur}>
                                        {v.valeur}
                                    </span>
                                    <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                                        ({v.nombre})
                                    </span>
                                </label>
                            ))}
                            {valeurs.length === 0 && (
                                <p className="px-3 py-3 text-sm font-normal text-gray-400 dark:text-gray-600">
                                    Aucune valeur.
                                </p>
                            )}
                        </div>

                        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                disabled={!actif}
                                className="w-full rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                            >
                                Effacer le filtre
                            </button>
                        </div>
                    </div>
                )}
            </span>
        </span>
    );
}

/** Valeurs distinctes d'un champ, avec leur nombre de lignes, triées par fréquence. */
export function valeursDistinctes(lignes, champ, libelleVide) {
    const compteurs = new Map();
    for (const l of lignes) {
        const cle = (l[champ] || '').trim() || libelleVide;
        compteurs.set(cle, (compteurs.get(cle) || 0) + 1);
    }

    return [...compteurs.entries()]
        .map(([valeur, nombre]) => ({ valeur, nombre }))
        .sort((a, b) => b.nombre - a.nombre);
}
