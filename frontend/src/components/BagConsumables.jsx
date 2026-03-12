import React, { useState, useEffect, useCallback } from 'react';
import { Package, Trash2, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { confirm } from './ConfirmDialog';

function BagConsumables({ bagId, authenticatedFetch, onUpdateCost }) {
    const [consumablesList, setConsumablesList] = useState([]); // Linked consumables
    const [availableConsumables, setAvailableConsumables] = useState([]); // Dropdown options
    const [loading, setLoading] = useState(false);

    // Form state
    const [selectedConsumableId, setSelectedConsumableId] = useState('');
    const [usagePercent, setUsagePercent] = useState(10); // Default 10%

    // Inline create state
    const [showInlineCreate, setShowInlineCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [creating, setCreating] = useState(false);

    // Fetch available consumables for dropdown
    const fetchAvailableConsumables = useCallback(async () => {
        try {
            const resp = await authenticatedFetch('/api/consumables');
            if (resp.ok) {
                const data = await resp.json();
                setAvailableConsumables(data);
            }
        } catch (err) {
            console.error('Failed to fetch consumables', err);
        }
    }, [authenticatedFetch]);

    // Fetch linked consumables
    const fetchLinkedConsumables = useCallback(async () => {
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
    }, [bagId, authenticatedFetch]);

    useEffect(() => {
        if (bagId) {
            fetchLinkedConsumables();
            fetchAvailableConsumables();
        }
    }, [bagId, fetchLinkedConsumables, fetchAvailableConsumables]);

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

    const handleCreateAndSelect = async () => {
        if (!newName.trim()) { toast.error('Le nom est obligatoire'); return; }
        const price = parseFloat(newPrice) || 0;
        setCreating(true);
        try {
            const resp = await authenticatedFetch('/api/consumables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), purchase_price: price })
            });
            if (resp.ok) {
                const data = await resp.json();
                await fetchAvailableConsumables();
                setSelectedConsumableId(String(data.id));
                setNewName('');
                setNewPrice('');
                setShowInlineCreate(false);
                toast.success('Produit créé et sélectionné');
            } else {
                const err = await resp.json();
                toast.error(err.error || 'Erreur lors de la création');
            }
        } catch {
            toast.error('Erreur technique');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteLink = async (id, cost) => {
        if (!await confirm('Retirer ce produit et annuler le coût associé ?')) return;
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
    const selectedConsumableDetails = availableConsumables.find(c => c.id === Number(selectedConsumableId));
    const estimatedCost = selectedConsumableDetails
        ? (selectedConsumableDetails.purchase_price * (usagePercent / 100)).toFixed(2)
        : '0.00';

    return (
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#555' }}>
                <Package size={20} /> Matériel utilisé
            </h3>

            {/* Add form */}
            <div style={{ background: '#f8f9fa', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 60px 38px', gap: '0.5rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.2rem', display: 'block' }}>Produit</label>
                        <select
                            value={selectedConsumableId}
                            onChange={e => setSelectedConsumableId(e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                        >
                            <option value="">— Choisir —</option>
                            {availableConsumables.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name}{c.brand ? ` (${c.brand})` : ''} — {c.purchase_price}€
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.2rem', display: 'block' }}>% utilisé</label>
                        <input
                            type="number" min="1" max="100"
                            value={usagePercent}
                            onChange={e => setUsagePercent(e.target.value)}
                            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.2rem', display: 'block' }}>Coût</label>
                        <div style={{ padding: '0.45rem 0.5rem', background: '#e9ecef', borderRadius: '6px', textAlign: 'center', fontWeight: '600', fontSize: '0.82rem', color: '#495057' }}>
                            {estimatedCost}€
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddConsumable}
                        className="btn-primary"
                        style={{ height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        disabled={!selectedConsumableId}
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Inline create */}
                <div style={{ marginTop: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={() => setShowInlineCreate(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.78rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                        <Plus size={12} /> {showInlineCreate ? 'Annuler' : 'Créer un produit'}
                    </button>
                    {showInlineCreate && (
                        <div style={{ marginTop: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 80px 38px', gap: '0.4rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Nom"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                style={{ minWidth: 0, padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.82rem' }}
                            />
                            <input
                                type="number"
                                placeholder="Prix €"
                                value={newPrice}
                                onChange={e => setNewPrice(e.target.value)}
                                min="0" step="0.01"
                                style={{ minWidth: 0, padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.82rem' }}
                            />
                            <button
                                type="button"
                                onClick={handleCreateAndSelect}
                                disabled={creating || !newName.trim()}
                                className="btn-primary"
                                style={{ height: '34px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem' }}
                            >
                                {creating ? '…' : <Plus size={16} />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Used consumables list */}
            {loading ? (
                <p style={{ fontSize: '0.85rem', color: '#aaa' }}>Chargement…</p>
            ) : consumablesList.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#bbb', fontStyle: 'italic' }}>Aucun matériel utilisé pour l'instant.</p>
            ) : (
                <div>
                    {consumablesList.map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.88rem' }}>
                            <span style={{ flex: 1, color: '#333' }}>{item.consumable_name || 'Produit supprimé'}</span>
                            <span style={{ color: '#888', marginRight: '1rem' }}>{item.used_percentage}%</span>
                            <span style={{ fontWeight: '600', color: '#e67e22', marginRight: '0.75rem' }}>+{item.cost_at_time.toFixed(2)} €</span>
                            <button
                                type="button"
                                onClick={() => handleDeleteLink(item.id, item.cost_at_time)}
                                style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default BagConsumables;
