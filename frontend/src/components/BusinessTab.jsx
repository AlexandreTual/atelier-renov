import React, { useState } from 'react'
import { Plus, Trash2, Download, Calculator, TrendingUp, TrendingDown } from 'lucide-react'
import StatCard from './StatCard'

function BusinessTab({ expenses, bags, fetchExpenses, authenticatedFetch }) {
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        description: '',
        amount: 0,
        category: 'other',
        date: new Date().toISOString().split('T')[0]
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const resp = await authenticatedFetch(`/api/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (resp.ok) {
                setShowModal(false)
                fetchExpenses()
                setFormData({ description: '', amount: 0, category: 'other', date: new Date().toISOString().split('T')[0] })
            }
        } catch (err) {
            console.error('Failed to save expense', err)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Supprimer cette dépense ?')) return
        try {
            await authenticatedFetch(`/api/expenses/${id}`, { method: 'DELETE' })
            fetchExpenses()
        } catch (err) {
            console.error('Failed to delete expense', err)
        }
    }

    const exportCSV = async () => {
        const resp = await authenticatedFetch('/api/export/csv')
        const blob = await resp.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'tableau_de_bord_atelier.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
    }

    // Calculations
    const totalSales = bags.reduce((acc, b) => b.status === 'sold' ? acc + b.actual_resale_price : acc, 0)
    const bagCosts = bags.reduce((acc, b) => b.status === 'sold' ? acc + b.purchase_price + (b.fees || 0) + (b.material_costs || 0) : acc, 0)
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)
    const netProfit = totalSales - bagCosts - totalExpenses

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calculator size={24} /> Pilotage Business
                </h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={exportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={20} /> Exporter CSV
                    </button>
                    <button onClick={() => setShowModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> Nouvelle dépense
                    </button>
                </div>
            </div>

            <div className="stats-grid" style={{ marginBottom: '3rem' }}>
                <StatCard label="Chiffre d'Affaires Total" value={`${totalSales.toFixed(2)} €`} />
                <StatCard label="Dépenses Générales" value={`-${totalExpenses.toFixed(2)} €`} style={{ color: '#e74c3c' }} />
                <StatCard
                    label="Bénéfice Net Réel"
                    value={<>
                        {netProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        {netProfit.toFixed(2)} €
                    </>}
                    style={{
                        color: netProfit >= 0 ? '#2ecc71' : '#e74c3c',
                        background: netProfit >= 0 ? '#eafaf1' : '#fdedec'
                    }}
                />
            </div>

            <div className="inventory-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="bag-card" style={{ padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Description</th>
                                <th style={{ textAlign: 'left', padding: '1rem' }}>Catégorie</th>
                                <th style={{ textAlign: 'right', padding: '1rem' }}>Montant</th>
                                <th style={{ textAlign: 'center', padding: '1rem' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map(e => (
                                <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '1rem' }}>{e.date}</td>
                                    <td style={{ padding: '1rem' }}>{e.description}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: '#eee', fontSize: '0.8rem' }}>
                                            {e.category}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>{e.amount.toFixed(2)} €</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Aucune dépense enregistrée</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Nouvelle dépense générale</h2>
                        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label>Description</label>
                                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="ex: Packaging, Publicité, Outils..." required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Montant (€)</label>
                                    <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Date</label>
                                    <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Catégorie</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    <option value="tools">Outils & Matériel</option>
                                    <option value="marketing">Marketing/PUB</option>
                                    <option value="packaging">Packaging & Envoi</option>
                                    <option value="other">Autre</option>
                                </select>
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

export default BusinessTab
