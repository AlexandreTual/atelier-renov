import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useProjectData = (authenticatedFetch) => {
    const [bags, setBags] = useState([]);
    const [bagTotal, setBagTotal] = useState(0);
    const [bagStats, setBagStats] = useState({ totalProfit: 0, activeRenovations: 0, stockValueEst: 0, capitalImmobilized: 0 });
    const [dashboardBags, setDashboardBags] = useState([]);
    const [dashboardLists, setDashboardLists] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [brands, setBrands] = useState([]);
    const [itemTypes, setItemTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBags = useCallback(async (params = {}) => {
        try {
            const qs = new URLSearchParams();
            if (params.search)  qs.set('search', params.search);
            if (params.brand && params.brand !== 'all')   qs.set('brand',  params.brand);
            if (params.status && params.status !== 'all') qs.set('status', params.status);
            if (params.type   && params.type   !== 'all') qs.set('type',   params.type);
            if (params.sort)    qs.set('sort',  params.sort);
            if (params.page  != null) qs.set('page',  params.page);
            if (params.limit != null) qs.set('limit', params.limit);
            const resp = await authenticatedFetch(`/api/bags?${qs}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            setBags(data.bags);
            setBagTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch bags', err);
            toast.error('Impossible de charger les articles');
        }
    }, [authenticatedFetch]);

    const fetchBagStats = useCallback(async () => {
        try {
            const resp = await authenticatedFetch('/api/bags/stats');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            setBagStats(await resp.json());
        } catch (err) {
            console.error('Failed to fetch bag stats', err);
        }
    }, [authenticatedFetch]);

    // Loads all non-sold bags (for dashboard lists) — typically a small working set
    const fetchDashboardBags = useCallback(async () => {
        try {
            const statuses = ['to_be_cleaned','cleaning','repairing','drying','for_sale'].join(',');
            const resp = await authenticatedFetch(`/api/bags?status=${statuses}&limit=500`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            setDashboardBags(data.bags);
        } catch (err) {
            console.error('Failed to fetch dashboard bags', err);
        }
    }, [authenticatedFetch]);

    const fetchDashboardLists = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/dashboard-lists`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            setDashboardLists(await resp.json());
        } catch (err) {
            console.error('Failed to fetch dashboard lists', err);
            toast.error('Impossible de charger les listes');
        }
    }, [authenticatedFetch]);

    const fetchConsumables = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/consumables`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            setConsumables(await resp.json());
        } catch (err) {
            console.error('Failed to fetch consumables', err);
            toast.error('Impossible de charger les consommables');
        }
    }, [authenticatedFetch]);

    const fetchExpenses = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/expenses`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            setExpenses(await resp.json());
        } catch (err) {
            console.error('Failed to fetch expenses', err);
            toast.error('Impossible de charger les dépenses');
        }
    }, [authenticatedFetch]);

    const fetchBrands = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/brands`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            setBrands(await resp.json());
        } catch (err) {
            console.error('Failed to fetch brands', err);
            toast.error('Impossible de charger les marques');
        }
    }, [authenticatedFetch]);

    const fetchItemTypes = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/item-types`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            setItemTypes(await resp.json());
        } catch (err) {
            console.error('Failed to fetch item types', err);
            toast.error('Impossible de charger les types');
        }
    }, [authenticatedFetch]);

    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchBags({ page: 0, limit: 50 }),
            fetchBagStats(),
            fetchDashboardBags(),
            fetchDashboardLists(),
            fetchConsumables(),
            fetchExpenses(),
            fetchBrands(),
            fetchItemTypes(),
        ]);
        setIsLoading(false);
    }, [fetchBags, fetchBagStats, fetchDashboardBags, fetchDashboardLists, fetchConsumables, fetchExpenses, fetchBrands, fetchItemTypes]);

    return {
        bags, setBags, bagTotal, bagStats,
        dashboardBags,
        dashboardLists, setDashboardLists,
        consumables, setConsumables,
        expenses, setExpenses,
        brands, setBrands,
        itemTypes, setItemTypes,
        isLoading,
        fetchBags,
        fetchBagStats,
        fetchDashboardBags,
        fetchDashboardLists,
        fetchConsumables,
        fetchExpenses,
        fetchBrands,
        fetchItemTypes,
        fetchAll,
    };
};
