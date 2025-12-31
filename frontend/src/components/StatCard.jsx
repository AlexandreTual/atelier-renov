import React from 'react'

function StatCard({ label, value, className = '', style = {} }) {
    return (
        <div className="stat-card" style={style}>
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${className}`}>
                {value}
            </div>
        </div>
    )
}

export default StatCard
