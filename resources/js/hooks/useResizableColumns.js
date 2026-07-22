import { useState } from 'react';

export function useResizableColumns(initialWidths) {
    const [widths, setWidths] = useState(initialWidths);
    const [colonneActive, setColonneActive] = useState(null); // colonne en cours de redimensionnement

    function startResize(e, key) {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = widths[key] ?? 150;
        setColonneActive(key);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        function onMouseMove(ev) {
            setWidths((w) => ({ ...w, [key]: Math.max(50, startWidth + (ev.clientX - startX)) }));
        }
        function onMouseUp() {
            setColonneActive(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    return [widths, startResize, colonneActive];
}
