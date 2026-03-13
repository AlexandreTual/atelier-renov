import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Package, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { confirm } from './ConfirmDialog'

const LOW_STOCK_THRESHOLD = 1

function ConsumablesTab({ consumables, fetchConsumables, authenticatedFetch }) {
    const [showModal, setShowModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [formData, setFormData] = useState({
        name: '',
        brand: '',
        purchase_price: 0,
        quantity: 1,
        unit: 'unité',
        remaining_percentage: 100,
        notes: ''
    })

    const openModal = (item = null) => {
        if (item) {
            setSelectedItem(item)
            setFormData({ ...item })
        } else {
            setSelectedItem(null)
            setFormData({
                name: '',
                brand: '',
                purchase_price: 0,
                quantity: 1,
                unit: 'unité',
                remaining_percentage: 100,
                notes: ''
            })
        }
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const method = selectedItem ? 'PUT' : 'POST'
        const url = selectedItem ? `/api/consumables/${selectedItem.id}` : `/api/consumables`

        try {
            const resp = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (resp.ok) {
                setShowModal(false)
                fetchConsumables()
                toast.success(selectedItem ? 'Produit mis à jour' : 'Produit ajouté')
            } else {
                toast.error('Erreur lors de l\'enregistrement')
            }
        } catch (err) {
            console.error('Failed to save consumable', err)
            toast.error('Échec de la communication avec le serveur')
        }
    }

    const handleDelete = async (id) => {
        if (!await confirm('Supprimer ce produit ?')) return
        try {
            const resp = await authenticatedFetch(`/api/consumables/${id}`, { method: 'DELETE' })
            if (resp.ok) {
                fetchConsumables()
                toast.success('Produit supprimé')
            } else {
                toast.error('Erreur lors de la suppression')
            }
        } catch (err) {
            console.error('Failed to delete consumable', err)
            toast.error('Échec de la suppression')
        }
    }

    const filteredConsumables = consumables.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.brand && c.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    const lowStockItems = consumables.filter(c => (c.quantity ?? 0) <= LOW_STOCK_THRESHOLD)

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Package size={24} /> Inventaire Consommables
                </h2>
                <button onClick={() => openModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} /> Ajouter un produit
                </button>
            </div>

            <input
                type="text"
                placeholder="Rechercher un produit ou une marque..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', marginBottom: '1.5rem', boxSizing: 'border-box' }}
            />

            {lowStockItems.length > 0 && (
                <div style={{
                    background: '#fff8e1',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}>
                    <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', color: '#92400e', fontSize: '0.9rem' }}>
                        Stock faible :
                    </span>
                    <span style={{ color: '#92400e', fontSize: '0.9rem' }}>
                        {lowStockItems.map(c => `${c.name} (${c.quantity} ${c.unit})`).join(' · ')}
                    </span>
                </div>
            )}

            <div className="inventory-grid">
                {filteredConsumables.map(item => (
                    <div key={item.id} className="bag-card" style={{ padding: '1rem', outline: (item.quantity ?? 0) <= LOW_STOCK_THRESHOLD ? '2px solid #f59e0b' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <h3 style={{ margin: 0 }}>{item.name}</h3>
                                    {(item.quantity ?? 0) <= LOW_STOCK_THRESHOLD && (
                                        <span style={{ fontSize: '0.7rem', fontWeight: '700', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <AlertTriangle size={10} /> Stock faible
                                        </span>
                                    )}
                                </div>
                                {item.brand && <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>{item.brand}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => openModal(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#555' }}>
                            <span>{item.quantity} {item.unit} en stock</span>
                            <span style={{ fontWeight: '600' }}>{item.purchase_price} €</span>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{selectedItem ? 'Modifier le produit' : 'Nouveau produit'}</h2>
                        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label>Nom du produit</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Marque</label>
                                <input type="text" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Prix d'achat (€)</label>
                                    <input type="number" step="0.01" value={formData.purchase_price} onChange={e => setFormData({ ...formData, purchase_price: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Quantité en stock</label>
                                    <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Unité (ml, g, unité…)</label>
                                <input type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
                            </div>
                            <div className="modal-actions" style={{ marginTop: '2rem' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                                <button type="submit" className="btn-primary">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}

export default ConsumablesTab
