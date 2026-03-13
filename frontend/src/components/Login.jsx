import React, { useState } from 'react'
import { Lock, Mail, Briefcase } from 'lucide-react'

function Login({ onLogin }) {
    const [view, setView] = useState('login') // 'login' | 'register' | 'forgot'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [forgotSent, setForgotSent] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (view === 'register' && password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas')
            setLoading(false)
            return
        }

        if (view === 'forgot') {
            try {
                await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                })
                setForgotSent(true)
            } catch {
                setError('Erreur de connexion au serveur')
            } finally {
                setLoading(false)
            }
            return
        }

        try {
            const endpoint = view === 'login' ? '/api/login' : '/api/register'
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            let data = {}
            try { data = await resp.json() } catch { /* non-JSON response */ }

            if (resp.ok) {
                onLogin(data.token)
            } else {
                setError(data.error || (view === 'login' ? 'Identifiants invalides' : 'Erreur lors de la création du compte'))
            }
        } catch {
            setError('Erreur de connexion au serveur')
        } finally {
            setLoading(false)
        }
    }

    const switchView = (v) => {
        setView(v)
        setError('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setForgotSent(false)
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

                <h2 style={{ marginBottom: '0.5rem' }}>
                    {view === 'login' ? 'Connexion' : view === 'register' ? 'Créer un compte' : 'Mot de passe oublié'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    {view === 'login' ? 'Connectez-vous à votre espace'
                        : view === 'register' ? "Rejoignez Atelier Rénov'"
                        : 'Recevez un lien de réinitialisation par email'}
                </p>

                {forgotSent ? (
                    <>
                        <p style={{ color: '#27ae60', marginBottom: '1.5rem' }}>
                            Si un compte existe pour cet email, un lien de réinitialisation vous a été envoyé.
                        </p>
                        <button onClick={() => switchView('login')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}>
                            Retour à la connexion
                        </button>
                    </>
                ) : (
                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={16} /> Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vous@exemple.fr"
                            required
                            style={{ marginTop: '0.5rem' }}
                        />
                    </div>

                    {view !== 'forgot' && (
                        <div className="form-group" style={{ textAlign: 'left', marginTop: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Lock size={16} /> Mot de passe
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
                            {view === 'register' && (
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    8 caractères minimum
                                </p>
                            )}
                        </div>
                    )}

                    {view === 'register' && (
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
                    )}

                    {view === 'login' && (
                        <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                            <button type="button" onClick={() => switchView('forgot')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>
                                Mot de passe oublié ?
                            </button>
                        </div>
                    )}

                    {error && <p style={{ color: '#e74c3c', fontSize: '0.875rem', marginTop: '1rem', marginBottom: '0' }}>{error}</p>}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}
                    >
                        {loading
                            ? '...'
                            : view === 'login' ? 'Se connecter'
                            : view === 'register' ? 'Créer mon compte'
                            : 'Envoyer le lien'
                        }
                    </button>
                </form>
                )}

                <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {view === 'login' ? (
                        <>Pas encore de compte ?{' '}
                            <button onClick={() => switchView('register')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>
                                S'inscrire
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => switchView('login')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>
                                Retour à la connexion
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}

export default Login
