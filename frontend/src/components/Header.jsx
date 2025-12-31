import React from 'react'
import { Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'

function Header({ onAddNew }) {
    const location = useLocation()

    const getTitle = () => {
        switch (location.pathname) {
            case '/dashboard': return 'Tableau de bord'
            case '/inventory': return 'Ma Collection'
            case '/stocks': return 'Gestion des Stocks'
            case '/business': return 'Pilotage Business'
            case '/settings': return 'Paramètres'
            default: return 'Atelier Rénov\''
        }
    }

    const date = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    return (
        <header className="header">
            <div>
                <h1>{getTitle()}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>{date}</p>
            </div>
            {(location.pathname === '/inventory' || location.pathname === '/dashboard') && (
                <button className="btn-primary" onClick={onAddNew}>
                    <Plus size={20} />
                    Nouveau sac
                </button>
            )}
        </header>
    )
}

export default Header
