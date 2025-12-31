import React from 'react'
import { Briefcase, LayoutDashboard, Package, LogOut, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'

function Sidebar({ onLogout }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <Briefcase size={24} />
                <span>Atelier Rénov'</span>
            </div>
            <nav style={{ flex: 1 }}>
                <ul className="nav-links">
                    <li className="nav-item">
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <LayoutDashboard size={20} />
                            Dashboard
                        </NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink
                            to="/inventory"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Package size={20} />
                            Inventaire
                        </NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink
                            to="/stocks"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Package size={20} />
                            Stocks Materiels
                        </NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink
                            to="/business"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Briefcase size={20} />
                            Business
                        </NavLink>
                    </li>
                    <li className="nav-item">
                        <NavLink
                            to="/settings"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Settings size={20} />
                            Paramètres
                        </NavLink>
                    </li>
                </ul>
            </nav>
            <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <button
                    className="nav-link"
                    onClick={onLogout}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#e74c3c' }}
                >
                    <LogOut size={20} />
                    Déconnexion
                </button>
            </div>
        </aside>
    )
}

export default Sidebar
