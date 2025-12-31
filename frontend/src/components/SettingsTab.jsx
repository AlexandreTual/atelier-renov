import React, { useState } from 'react';
import { Settings, Lock, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

function SettingsTab({ authenticatedFetch }) {
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return toast.error('Les nouveaux mots de passe ne correspondent pas');
        }

        if (passwordData.newPassword.length < 4) {
            return toast.error('Le nouveau mot de passe est trop court');
        }

        setIsLoading(true);
        try {
            const resp = await authenticatedFetch('/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                toast.success('Mot de passe mis à jour avec succès');
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                toast.error(data.error || 'Erreur lors du changement');
            }
        } catch (err) {
            toast.error('Erreur technique');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
                <Settings size={24} />
                <h2>Paramètres du compte</h2>
            </div>

            <div className="inventory-grid" style={{ gridTemplateColumns: 'minmax(300px, 600px)' }}>
                <div className="bag-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--accent-gold)' }}>
                        <Lock size={20} />
                        <h3 style={{ margin: 0 }}>Changer le mot de passe</h3>
                    </div>

                    <form onSubmit={handlePasswordChange}>
                        <div className="form-group">
                            <label>Mot de passe actuel</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Nouveau mot de passe</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Confirmer le nouveau</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            <button
                                type="submit"
                                className="btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={isLoading}
                            >
                                <Save size={20} />
                                {isLoading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bag-card" style={{ padding: '2rem', border: '1px dashed var(--accent-gold)', background: 'rgba(212, 175, 55, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-gold)' }}>
                        <ShieldCheck size={20} />
                        <h3 style={{ margin: 0 }}>Sécurité de la session</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Votre session est protégée par un token JWT sécurisé qui expire après 7 jours d'inactivité.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        L'accès aux photos et aux données financières est strictement réservé à votre compte administrateur.
                    </p>
                </div>
            </div>
        </section>
    );
}

export default SettingsTab;
