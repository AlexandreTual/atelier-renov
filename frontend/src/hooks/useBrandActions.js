import { useCallback } from 'react';

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
        } catch (err) {
            console.error('Failed to add brand', err);
        }
        return false;
    }, [authenticatedFetch, onSuccess]);

    return { handleAddBrand };
};
