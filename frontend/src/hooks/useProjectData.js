import { useState, useCallback } from 'react';

export const useProjectData = (authenticatedFetch) => {
    const [bags, setBags] = useState([]);
    const [dashboardLists, setDashboardLists] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [brands, setBrands] = useState([]);
    const [itemTypes, setItemTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBags = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/bags`);
            const data = await resp.json();
            setBags(data);
        } catch (err) {
            console.error('Failed to fetch bags', err);
        }
    }, [authenticatedFetch]);

    const fetchDashboardLists = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/dashboard-lists`);
            const data = await resp.json();
            setDashboardLists(data);
        } catch (err) {
            console.error('Failed to fetch dashboard lists', err);
        }
    }, [authenticatedFetch]);

    const fetchConsumables = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/consumables`);
            const data = await resp.json();
            setConsumables(data);
        } catch (err) {
            console.error('Failed to fetch consumables', err);
        }
    }, [authenticatedFetch]);

    const fetchExpenses = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/expenses`);
            const data = await resp.json();
            setExpenses(data);
        } catch (err) {
            console.error('Failed to fetch expenses', err);
        }
    }, [authenticatedFetch]);

    const fetchBrands = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/brands`);
            const data = await resp.json();
            setBrands(data);
        } catch (err) {
            console.error('Failed to fetch brands', err);
        }
    }, [authenticatedFetch]);

    const fetchItemTypes = useCallback(async () => {
        try {
            const resp = await authenticatedFetch(`/api/item-types`);
            const data = await resp.json();
            setItemTypes(data);
        } catch (err) {
            console.error('Failed to fetch item types', err);
        }
    }, [authenticatedFetch]);

    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        await Promise.all([
            fetchBags(),
            fetchDashboardLists(),
            fetchConsumables(),
            fetchExpenses(),
            fetchBrands(),
            fetchItemTypes()
        ]);
        setIsLoading(false);
    }, [fetchBags, fetchDashboardLists, fetchConsumables, fetchExpenses, fetchBrands, fetchItemTypes]);

    return {
        bags, setBags,
        dashboardLists, setDashboardLists,
        consumables, setConsumables,
        expenses, setExpenses,
        brands, setBrands,
        itemTypes, setItemTypes,
        isLoading,
        fetchBags,
        fetchDashboardLists,
        fetchConsumables,
        fetchExpenses,
        fetchBrands,
        fetchItemTypes,
        fetchAll
    };
};
