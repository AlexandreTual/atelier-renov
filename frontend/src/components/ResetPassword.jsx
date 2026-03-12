import React, { useState } from 'react'
import { Lock, Briefcase } from 'lucide-react'

function ResetPassword() {
    const token = new URLSearchParams(window.location.search).get('token')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas')
            return
        }

        setLoading(true)
        try {
            const resp = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            })
            const data = await resp.json()
            if (resp.ok) {
                setSuccess(true)
            } else {
                setError(data.error || 'Erreur lors de la réinitialisation')
            }
        } catch {
            setError('Erreur de connexion au serveur')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <div style={{ background: 'white', padding: '2.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                <div className="sidebar-logo" style={{ justifyContent: 'center', color: 'var(--text-primary)', marginBottom: '2rem' }}>
                    <Briefcase size={32} color="var(--accent-gold)" />
                    <span style={{ fontSize: '1.75rem', marginLeft: '0.5rem' }}>Atelier Rénov'</span>
                </div>

                <h2 style={{ marginBottom: '0.5rem' }}>Nouveau mot de passe</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Choisissez un mot de passe sécurisé (min. 8 caractères)
                </p>

                {!token ? (
                    <p style={{ color: '#e74c3c' }}>Lien invalide ou manquant.</p>
                ) : success ? (
                    <>
                        <p style={{ color: '#27ae60', marginBottom: '1.5rem' }}>
                            Mot de passe mis à jour. Vous pouvez vous connecter.
                        </p>
                        <a href="/" style={{ color: 'var(--primary-color)', fontSize: '0.875rem' }}>
                            Aller à la connexion
                        </a>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Lock size={16} /> Nouveau mot de passe
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                style={{ marginTop: '0.5rem' }}
                            />
                        </div>

                        <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Lock size={16} /> Confirmer le mot de passe
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{ marginTop: '0.5rem' }}
                            />
                        </div>

                        {error && <p style={{ color: '#e74c3c', fontSize: '0.875rem', marginTop: '1rem', marginBottom: '0' }}>{error}</p>}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}
                        >
                            {loading ? '...' : 'Enregistrer le mot de passe'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

export default ResetPassword
