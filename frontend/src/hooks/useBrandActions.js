import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useBrandActions = (authenticatedFetch, onSuccess) => {
    const handleAddBrand = useCallback(async (brandName) => {
        try {
            const resp = await authenticatedFetch('/api/brands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: brandName })
            });
            if (resp.ok) {
                onSuccess();
                return true;
            }
            toast.error('Erreur lors de l\'ajout de la marque');
        } catch (err) {
            console.error('Failed to add brand', err);
            toast.error('Échec de l\'ajout de la marque');
        }
        return false;
    }, [authenticatedFetch, onSuccess]);

    return { handleAddBrand };
};
