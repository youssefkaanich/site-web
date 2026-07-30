import { useEffect, useState } from 'react';

/**
 * Fenêtre de confirmation.
 *
 * `saisieAttendue` (optionnel) : garde-fou pour les actions de masse. Le
 * bouton Confirmer reste désactivé tant que l'utilisateur n'a pas recopié
 * cette valeur (ex : le nombre de lignes à supprimer). Sert à éviter les
 * suppressions massives faites d'un clic réflexe après un "tout sélectionner".
 */
export default function ConfirmDialog({
    open,
    title = 'Confirmer',
    message,
    danger = false,
    saisieAttendue = null,
    onConfirm,
    onCancel,
}) {
    const [saisie, setSaisie] = useState('');

    // Remet le champ à zéro à chaque ouverture, sinon la saisie précédente
    // resterait et validerait la fenêtre suivante sans rien retaper.
    useEffect(() => {
        if (open) setSaisie('');
    }, [open, saisieAttendue]);

    if (!open) return null;

    const bloque = saisieAttendue !== null && saisie.trim() !== String(saisieAttendue);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[150] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h2 className="text-lg font-bold text-[#0d2b52] dark:text-white mb-2">{title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>

                {saisieAttendue !== null && (
                    <div className="mb-5">
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Action de masse. Tape{' '}
                            <span className="font-bold text-red-600 dark:text-red-400">{saisieAttendue}</span>{' '}
                            pour confirmer :
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={saisie}
                            onChange={(e) => setSaisie(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !bloque) onConfirm();
                            }}
                            className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm outline-none focus:border-red-500"
                        />
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={bloque}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed ${
                            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0d2b52] hover:bg-[#0d2b52]/90'
                        }`}
                    >
                        Confirmer
                    </button>
                </div>
            </div>
        </div>
    );
}
