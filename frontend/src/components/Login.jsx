import React, { useState } from 'react'
import { Lock, Briefcase } from 'lucide-react'

function Login({ onLogin }) {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const resp = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })

            const data = await resp.json()

            if (resp.ok) {
                onLogin(data.token)
            } else {
                setError(data.error || 'Mot de passe incorrect')
            }
        } catch (err) {
            setError('Erreur de connexion au serveur')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-container" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-primary)'
        }}>
            <div className="login-card" style={{
                background: 'white',
                padding: '2.5rem',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-md)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center'
            }}>
                <div className="sidebar-logo" style={{ justifyContent: 'center', color: 'var(--text-primary)', marginBottom: '2rem' }}>
                    <Briefcase size={32} color="var(--accent-gold)" />
                    <span style={{ fontSize: '1.75rem', marginLeft: '0.5rem' }}>Atelier Rénov'</span>
                </div>

                <h2 style={{ marginBottom: '0.5rem' }}>Connexion</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Espace réservé à l'administration</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Lock size={16} /> Mot de passe
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{ marginTop: '0.5rem' }}
                        />
                    </div>

                    {error && <p style={{ color: '#e74c3c', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login
