import { useCallback } from 'react';

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
        } catch (err) {
            console.error('Failed to add item type', err);
        }
        return false;
    }, [authenticatedFetch, onSuccess]);

    return { handleAddItemType };
};
