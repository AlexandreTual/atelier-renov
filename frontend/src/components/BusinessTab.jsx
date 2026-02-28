import React, { useState } from 'react'
import { Plus, Trash2, Download, Calculator, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import StatCard from './StatCard'
import PerformanceChart from './PerformanceChart'
import { calculateProfit } from '../utils/finance'
import { confirm } from './ConfirmDialog'

function BusinessTab({ expenses, bags, fetchExpenses, authenticatedFetch }) {
    const [showModal, setShowModal] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [expenseSort, setExpenseSort] = useState('date_desc')
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
                toast.success('Dépense ajoutée')
            } else {
                toast.error('Erreur lors de l\'enregistrement')
            }
        } catch (err) {
            console.error('Failed to save expense', err)
            toast.error('Échec de la communication avec le serveur')
        }
    }

    const handleDelete = async (id) => {
        if (!await confirm('Supprimer cette dépense ?')) return
        try {
            const resp = await authenticatedFetch(`/api/expenses/${id}`, { method: 'DELETE' })
            if (resp.ok) {
                fetchExpenses()
                toast.success('Dépense supprimée')
            } else {
                toast.error('Erreur lors de la suppression')
            }
        } catch (err) {
            console.error('Failed to delete expense', err)
            toast.error('Échec de la suppression')
        }
    }

    const exportCSV = async () => {
        if (exporting) return
        setExporting(true)
        const loadingToast = toast.loading('Export en cours...')
        try {
            const resp = await authenticatedFetch('/api/export/csv')
            if (!resp.ok) {
                toast.error('Erreur lors de l\'export', { id: loadingToast })
                return
            }
            const blob = await resp.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'tableau_de_bord_atelier.csv'
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
            toast.success('Export téléchargé', { id: loadingToast })
        } catch (err) {
            console.error('Failed to export CSV', err)
            toast.error('Échec de l\'export', { id: loadingToast })
        } finally {
            setExporting(false)
        }
    }

    // Calculations
    const totalSales = bags.reduce((acc, b) => b.status === 'sold' ? acc + (parseFloat(b.actual_resale_price) || 0) : acc, 0)
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)
    const netProfit = bags.filter(b => b.status === 'sold').reduce((acc, b) => acc + calculateProfit(b), 0) - totalExpenses

    const sortedExpenses = [...expenses].sort((a, b) => {
        if (expenseSort === 'date_asc') return a.date.localeCompare(b.date)
        if (expenseSort === 'amount_desc') return b.amount - a.amount
        if (expenseSort === 'amount_asc') return a.amount - b.amount
        return b.date.localeCompare(a.date) // date_desc default
    })

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calculator size={24} /> Pilotage Business
                </h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={exportCSV} className="btn-secondary" disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={20} /> {exporting ? 'Export...' : 'Exporter CSV'}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Dépenses générales</h3>
                <select value={expenseSort} onChange={e => setExpenseSort(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <option value="date_desc">Date (récente)</option>
                    <option value="date_asc">Date (ancienne)</option>
                    <option value="amount_desc">Montant ↓</option>
                    <option value="amount_asc">Montant ↑</option>
                </select>
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
                            {sortedExpenses.map(e => (
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

            <PerformanceChart authenticatedFetch={authenticatedFetch} />

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
