import React, { useState, useEffect } from 'react';
import { Calendar, Trash2, Plus, History } from 'lucide-react';
import { toast } from 'react-hot-toast';

function BagLog({ bagId, authenticatedFetch }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newLog, setNewLog] = useState({
        action: '',
        date: new Date().toISOString().split('T')[0]
    });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const resp = await authenticatedFetch(`/api/bags/${bagId}/logs`);
            if (resp.ok) {
                const data = await resp.json();
                setLogs(data);
            }
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (bagId) fetchLogs();
    }, [bagId]);

    const handleAddLog = async () => {
        if (!newLog.action || !newLog.date) {
            toast.error('Veuillez remplir tous les champs');
            return;
        }

        try {
            const resp = await authenticatedFetch(`/api/bags/${bagId}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLog)
            });
            if (resp.ok) {
                toast.success('Entrée ajoutée au journal');
                setNewLog({ action: '', date: new Date().toISOString().split('T')[0] });
                fetchLogs();
            } else {
                toast.error('Erreur lors de l\'ajout');
            }
        } catch (err) {
            toast.error('Erreur technique');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddLog();
        }
    };

    const handleDeleteLog = async (id) => {
        if (!confirm('Supprimer cette entrée ?')) return;
        try {
            const resp = await authenticatedFetch(`/api/logs/${id}`, { method: 'DELETE' });
            if (resp.ok) {
                toast.success('Entrée supprimée');
                fetchLogs();
            }
        } catch (err) {
            toast.error('Erreur de suppression');
        }
    };

    return (
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#555' }}>
                <History size={20} /> Journal de Bord
            </h3>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem', display: 'block' }}>Date</label>
                    <input
                        type="date"
                        value={newLog.date}
                        onChange={e => setNewLog({ ...newLog, date: e.target.value })}
                        onKeyDown={handleKeyDown}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ flex: 3 }}>
                    <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem', display: 'block' }}>Action effectuée</label>
                    <input
                        type="text"
                        value={newLog.action}
                        onChange={e => setNewLog({ ...newLog, action: e.target.value })}
                        onKeyDown={handleKeyDown}
                        placeholder="ex: Nettoyage savon terminé, Début teinte..."
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                </div>
                <button
                    type="button"
                    onClick={handleAddLog}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', height: '38px', marginBottom: '1px' }}
                >
                    <Plus size={18} />
                </button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {logs.length === 0 ? (
                    <p style={{ fontStyle: 'italic', color: '#999', fontSize: '0.9rem' }}>Aucune entrée dans le journal.</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {logs.map(log => (
                            <li key={log.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.75rem 0',
                                borderBottom: '1px solid #f9f9f9'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#666',
                                        background: '#f0f0f0',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <Calendar size={12} />
                                        {new Date(log.date).toLocaleDateString()}
                                    </span>
                                    <span>{log.action}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteLog(log.id)}
                                    style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '4px' }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default BagLog;
