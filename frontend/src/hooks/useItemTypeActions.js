import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useItemTypeActions = (authenticatedFetch, onSuccess) => {
    const handleAddItemType = useCallback(async (name) => {
        try {
            const resp = await authenticatedFetch('/api/item-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (resp.ok) {
                onSuccess();
                return true;
            }
            toast.error('Erreur lors de l\'ajout du type');
        } catch (err) {
            console.error('Failed to add item type', err);
            toast.error('Échec de l\'ajout du type');
        }
        return false;
    }, [authenticatedFetch, onSuccess]);

    return { handleAddItemType };
};
