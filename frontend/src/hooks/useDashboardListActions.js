import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useDashboardListActions = (authenticatedFetch, onSuccess) => {
    const handleSaveList = useCallback(async (listData, setShowListModal) => {
        const method = listData.id ? 'PUT' : 'POST';
        const url = listData.id ? `/api/dashboard-lists/${listData.id}` : `/api/dashboard-lists`;

        try {
            const resp = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(listData)
            });
            if (resp.ok) {
                setShowListModal(false);
                onSuccess();
                toast.success('Liste mise à jour');
            } else {
                toast.error('Erreur lors de l\'enregistrement de la liste');
            }
        } catch (err) {
            console.error('Failed to save list', err);
            toast.error('Erreur technique');
        }
    }, [authenticatedFetch, onSuccess]);

    const handleDeleteList = useCallback(async (id, setShowListModal) => {
        if (!confirm('Supprimer cette liste ?')) return;
        try {
            const resp = await authenticatedFetch(`/api/dashboard-lists/${id}`, { method: 'DELETE' });
            if (resp.ok) {
                setShowListModal(false);
                onSuccess();
                toast.success('Liste supprimée');
            } else {
                toast.error('Erreur lors de la suppression');
            }
        } catch (err) {
            console.error('Failed to delete list', err);
            toast.error('Erreur technique');
        }
    }, [authenticatedFetch, onSuccess]);

    const handleReorderList = useCallback(async (listId, direction, dashboardLists, setDashboardLists) => {
        const listIndex = dashboardLists.findIndex(l => l.id === listId);
        if (listIndex === -1) return;

        const newLists = [...dashboardLists];
        const targetIndex = direction === 'up' ? listIndex - 1 : listIndex + 1;

        if (targetIndex < 0 || targetIndex >= newLists.length) return;

        const temp = newLists[listIndex];
        newLists[listIndex] = newLists[targetIndex];
        newLists[targetIndex] = temp;

        const orders = newLists.map((list, index) => ({
            id: list.id,
            order_index: index
        }));

        setDashboardLists(newLists.map((l, i) => ({ ...l, order_index: i })));

        try {
            const resp = await authenticatedFetch('/api/dashboard-lists/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders })
            });
            if (!resp.ok) {
                onSuccess(); // Rollback
                toast.error('Échec de la réorganisation');
            }
        } catch (err) {
            console.error('Failed to reorder lists', err);
            onSuccess();
            toast.error('Erreur technique');
        }
    }, [authenticatedFetch, onSuccess]);

    return { handleSaveList, handleDeleteList, handleReorderList };
};
