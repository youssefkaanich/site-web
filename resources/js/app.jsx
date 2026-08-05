import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx');
        return pages[`./Pages/${name}.jsx`]();
    },

    // Barre de progression pendant le changement de page.
    //
    // `delay: 200` évite de la faire clignoter sur les pages qui répondent
    // instantanément : elle n'apparaît que si l'attente devient perceptible.
    // Couleur de marque plutôt que le bleu par défaut d'Inertia.
    progress: {
        color: '#0d2b52',
        delay: 200,
        showSpinner: false,
    },

    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
});
