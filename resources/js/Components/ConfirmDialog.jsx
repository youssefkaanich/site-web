export default function ConfirmDialog({ open, title = 'Confirmer', message, danger = false, onConfirm, onCancel }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[150] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h2 className="text-lg font-bold text-[#0d2b52] dark:text-white mb-2">{title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
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
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
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
