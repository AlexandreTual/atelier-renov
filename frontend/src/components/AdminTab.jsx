import React, { useState, useEffect, useCallback } from 'react'
import { Shield, Users, Settings, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

const ROLE_LABELS = { admin: 'Admin', user: 'Utilisateur' }
const ROLE_COLORS = { admin: '#c9a84c', user: '#666' }

function AdminTab({ authenticatedFetch, currentUserId }) {
    const [users, setUsers] = useState([])
    const [config, setConfig] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [usersRes, configRes] = await Promise.all([
                authenticatedFetch('/api/admin/users'),
                authenticatedFetch('/api/admin/config'),
            ])
            if (usersRes.ok) setUsers(await usersRes.json())
            if (configRes.ok) setConfig(await configRes.json())
        } catch {
            toast.error('Erreur de chargement')
        } finally {
            setLoading(false)
        }
    }, [authenticatedFetch])

    useEffect(() => { fetchData() }, [fetchData])

    const handleRoleChange = async (userId, newRole) => {
        const res = await authenticatedFetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole }),
        })
        if (res.ok) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success('Rôle mis à jour')
        } else {
            const data = await res.json()
            toast.error(data.error || 'Erreur')
        }
    }

    const handleToggleOnboarding = async () => {
        const newVal = config.onboarding_enabled ? 0 : 1
        const res = await authenticatedFetch('/api/admin/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ onboarding_enabled: newVal }),
        })
        if (res.ok) {
            setConfig(prev => ({ ...prev, onboarding_enabled: newVal }))
            toast.success(newVal ? 'Onboarding activé' : 'Onboarding désactivé')
        } else {
            toast.error('Erreur')
        }
    }

    if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Chargement…</div>

    return (
        <section style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
                <Shield size={22} color="var(--accent-gold)" /> Back-office admin
            </h2>

            {/* Config globale */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1rem' }}>
                    <Settings size={16} /> Configuration globale
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                        <div style={{ fontWeight: '500' }}>Onboarding</div>
                        <div style={{ fontSize: '0.82rem', color: '#888' }}>Afficher le tour de bienvenue aux nouveaux utilisateurs</div>
                    </div>
                    <button
                        onClick={handleToggleOnboarding}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: config?.onboarding_enabled ? 'var(--accent-gold)' : '#ccc', display: 'flex', alignItems: 'center' }}
                    >
                        {config?.onboarding_enabled
                            ? <ToggleRight size={32} />
                            : <ToggleLeft size={32} />
                        }
                    </button>
                </div>
            </div>

            {/* Gestion utilisateurs */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', padding: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1rem' }}>
                    <Users size={16} /> Utilisateurs ({users.length})
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f0f0f0', textAlign: 'left', color: '#888', fontSize: '0.8rem' }}>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Nom</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Inscrit le</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>Rôle</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                                <td style={{ padding: '0.75rem' }}>{u.email}</td>
                                <td style={{ padding: '0.75rem', color: '#555' }}>{u.username}</td>
                                <td style={{ padding: '0.75rem', color: '#aaa', fontSize: '0.82rem' }}>
                                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                    {u.id === currentUserId ? (
                                        <span style={{ color: ROLE_COLORS[u.role], fontWeight: '600', fontSize: '0.82rem' }}>
                                            {ROLE_LABELS[u.role]} (vous)
                                        </span>
                                    ) : (
                                        <select
                                            value={u.role}
                                            onChange={e => handleRoleChange(u.id, e.target.value)}
                                            style={{ border: '1px solid #eee', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.82rem', color: ROLE_COLORS[u.role], fontWeight: '600', cursor: 'pointer' }}
                                        >
                                            {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

export default AdminTab
