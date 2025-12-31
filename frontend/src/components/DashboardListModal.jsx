import React, { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'

const STATUSES = {
    to_be_cleaned: { label: 'À nettoyer' },
    cleaning: { label: 'Nettoyage' },
    repairing: { label: 'Réparation' },
    drying: { label: 'Séchage' },
    ready_for_sale: { label: 'Prêt à la vente' },
    selling: { label: 'En vente' },
    sold: { label: 'Vendu' }
}

function DashboardListModal({
    show,
    onClose,
    selectedList,
    onSave,
    onDelete
}) {
    const [title, setTitle] = useState('')
    const [selectedStatuses, setSelectedStatuses] = useState([])

    useEffect(() => {
        if (selectedList) {
            setTitle(selectedList.title)
            setSelectedStatuses(selectedList.filters || [])
        } else {
            setTitle('')
            setSelectedStatuses([])
        }
    }, [selectedList, show])

    if (!show) return null

    const toggleStatus = (status) => {
        if (selectedStatuses.includes(status)) {
            setSelectedStatuses(selectedStatuses.filter(s => s !== status))
        } else {
            setSelectedStatuses([...selectedStatuses, status])
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({
            ...selectedList,
            title,
            filters: selectedStatuses
        })
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2>{selectedList ? 'Modifier la liste' : 'Nouvelle liste'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Titre de la liste</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="ex: En cours de rénovation"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Statuts à afficher</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {Object.entries(STATUSES).map(([key, val]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleStatus(key)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '20px',
                                        border: '1px solid var(--border-color)',
                                        background: selectedStatuses.includes(key) ? 'var(--primary-color)' : 'white',
                                        color: selectedStatuses.includes(key) ? 'white' : 'inherit',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {val.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="modal-actions" style={{ marginTop: '2rem' }}>
                        {selectedList && (
                            <button
                                type="button"
                                className="btn-secondary"
                                style={{ marginRight: 'auto', color: '#e74c3c' }}
                                onClick={() => onDelete(selectedList.id)}
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn-primary" disabled={!title || selectedStatuses.length === 0}>
                            Enregistrer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default DashboardListModal
