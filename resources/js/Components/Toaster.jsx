import { useEffect, useState } from 'react';
import { ecouterToasts } from '../hooks/toast';

const DUREE_MS = 4000;

export default function Toaster() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        return ecouterToasts((item) => {
            setItems((actuels) => [...actuels, item]);
            setTimeout(() => {
                setItems((actuels) => actuels.filter((i) => i.id !== item.id));
            }, DUREE_MS);
        });
    }, []);

    if (items.length === 0) return null;

    return (
        <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 max-w-sm">
            {items.map((item) => (
                <div
                    key={item.id}
                    className={`px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
                        item.type === 'error' ? 'bg-red-600' : 'bg-[#0d2b52]'
                    }`}
                >
                    {item.message}
                </div>
            ))}
        </div>
    );
}
