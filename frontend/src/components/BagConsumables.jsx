import React, { useState, useEffect } from 'react';
import { Package, Trash2, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

function BagConsumables({ bagId, authenticatedFetch, onUpdateCost }) {
    const [consumablesList, setConsumablesList] = useState([]); // Linked consumables
    const [availableConsumables, setAvailableConsumables] = useState([]); // Dropdown options
    const [loading, setLoading] = useState(false);

    // Form state
    const [selectedConsumableId, setSelectedConsumableId] = useState('');
    const [usagePercent, setUsagePercent] = useState(10); // Default 10%

    // Fetch available consumables for dropdown
    const fetchAvailableConsumables = async () => {
        try {
            const resp = await authenticatedFetch('/api/consumables');
            if (resp.ok) {
                const data = await resp.json();
                setAvailableConsumables(data);
            }
        } catch (err) {
            console.error('Failed to fetch consumables', err);
        }
    };

    // Fetch linked consumables
    const fetchLinkedConsumables = async () => {
        setLoading(true);
        try {
            const resp = await authenticatedFetch(`/api/bags/${bagId}/consumables`);
            if (resp.ok) {
                const data = await resp.json();
                setConsumablesList(data);
            }
        } catch (err) {
            console.error('Failed to fetch linked consumables', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (bagId) {
            fetchLinkedConsumables();
            fetchAvailableConsumables();
        }
    }, [bagId]);

    const handleAddConsumable = async () => {
        if (!selectedConsumableId) {
            toast.error('Sélectionnez un produit');
            return;
        }

        try {
            const resp = await authenticatedFetch(`/api/bags/${bagId}/consumables`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    consumable_id: selectedConsumableId,
                    usage_percent: parseFloat(usagePercent)
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                toast.success(`Coût ajouté : +${data.cost_added?.toFixed(2)}€`);
                fetchLinkedConsumables();
                // Notify parent to update form data (material_costs)
                if (onUpdateCost && data.cost_added) {
                    onUpdateCost(data.cost_added);
                }
                setSelectedConsumableId('');
                setUsagePercent(10);
            } else {
                toast.error('Erreur lors de l\'ajout');
            }
        } catch (err) {
            toast.error('Erreur technique');
        }
    };

    const handleDeleteLink = async (id, cost) => {
        if (!confirm('Retirer ce produit et annuler le coût associé ?')) return;
        try {
            const resp = await authenticatedFetch(`/api/bag-consumables/${id}`, { method: 'DELETE' });
            if (resp.ok) {
                toast.success('Produit retiré');
                fetchLinkedConsumables();
                if (onUpdateCost) {
                    onUpdateCost(-cost); // Negative to subtract
                }
            } else {
                toast.error('Erreur de suppression');
            }
        } catch (err) {
            toast.error('Erreur technique');
        }
    };

    // Helper to get selected consumable details for preview
    const selectedConsumableDetails = availableConsumables.find(c => c.id == selectedConsumableId);
    const estimatedCost = selectedConsumableDetails
        ? (selectedConsumableDetails.purchase_price * (usagePercent / 100)).toFixed(2)
        : '0.00';

    return (
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#555' }}>
                <Package size={20} /> Matériel Utilisé (Liaison Stock)
            </h3>

            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>Produit</label>
                        <select
                            value={selectedConsumableId}
                            onChange={e => setSelectedConsumableId(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                        >
                            <option value="">-- Choisir --</option>
                            {availableConsumables.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.brand}) - {c.purchase_price}€
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>Utilisation (%)</label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={usagePercent}
                            onChange={e => setUsagePercent(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>Coût Est.</label>
                        <div style={{ padding: '0.5rem', background: '#e9ecef', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', color: '#495057' }}>
                            {estimatedCost} €
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddConsumable}
                        className="btn-primary"
                        style={{ height: '38px', padding: '0 1rem' }}
                        disabled={!selectedConsumableId}
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {consumablesList.length > 0 && (
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: '#f1f1f1', color: '#666' }}>
                                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Produit</th>
                                <th style={{ padding: '0.5rem', textAlign: 'center' }}>% Utilisé</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Coût Ajouté</th>
                                <th style={{ padding: '0.5rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {consumablesList.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '0.5rem' }}>{item.consumable_name || 'Produit supprimé'}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.used_percentage}%</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#e67e22' }}>
                                        +{item.cost_at_time.toFixed(2)} €
                                    </td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteLink(item.id, item.cost_at_time)}
                                            style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default BagConsumables;
