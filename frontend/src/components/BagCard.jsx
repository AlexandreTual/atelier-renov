import React from 'react'
import { ImageIcon, Clock, CheckCircle2, TrendingUp } from 'lucide-react'

const STATUSES = {
  to_be_cleaned: { label: 'À nettoyer', color: '#666', icon: <Clock size={16} /> },
  cleaning: { label: 'Nettoyage', color: '#3498db', icon: <Clock size={16} /> },
  repairing: { label: 'Réparation', color: '#e67e22', icon: <Clock size={16} /> },
  drying: { label: 'Séchage', color: '#1abc9c', icon: <Clock size={16} /> },
  ready_for_sale: { label: 'Prêt à la vente', color: '#9b59b6', icon: <CheckCircle2 size={16} /> },
  selling: { label: 'En vente', color: '#f1c40f', icon: <TrendingUp size={16} /> },
  sold: { label: 'Vendu', color: '#2ecc71', icon: <CheckCircle2 size={16} /> }
}

function BagCard({ bag, onClick }) {
  const currentStatus = STATUSES[bag.status] || STATUSES.to_be_cleaned
  const profit = bag.status === 'sold'
    ? (bag.actual_resale_price - bag.purchase_price - (bag.fees || 0) - (bag.material_costs || 0))
    : (bag.target_resale_price - bag.purchase_price - (bag.material_costs || 0))

  const mainImage = bag.images && bag.images.length > 0 ? bag.images[0].url : null

  return (
    <div className="bag-card" onClick={onClick}>
      <div className="bag-image" style={{ background: mainImage ? 'none' : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)' }}>
        {mainImage ? (
          <img src={mainImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={bag.name} />
        ) : (
          <ImageIcon size={48} color="#aaa" />
        )}
        <span className="status-badge" style={{ color: currentStatus.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {currentStatus.icon} {currentStatus.label}
        </span>
      </div>
      <div className="bag-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="bag-brand">{bag.brand}</div>
            <div className="bag-name">{bag.name}</div>
            {bag.purchase_source && (
              <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.25rem' }}>
                Provenant de : {bag.purchase_source}
              </div>
            )}
            {!!bag.is_donation && (
              <span style={{
                fontSize: '0.65rem',
                background: '#e8f5e9',
                color: '#2e7d32',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '600',
                marginTop: '0.25rem',
                display: 'inline-block'
              }}>
                DON
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>{bag.status === 'sold' ? 'Profit Réel' : 'Profit Est.'}</div>
            <div style={{ fontWeight: '700', color: profit >= 0 ? 'var(--accent-green)' : '#e74c3c' }}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(2)} €
            </div>
          </div>
        </div>
        <div className="bag-prices">
          <div className="price-item">
            <span className="price-label">Achat</span>
            <span className="price-value">{Number(bag.purchase_price || 0).toFixed(2)} €</span>
          </div>
          <div className="price-item">
            <span className="price-label">{bag.status === 'sold' ? 'Vendu' : 'Objectif'}</span>
            <span className="price-value">{Number(bag.status === 'sold' ? bag.actual_resale_price : bag.target_resale_price || 0).toFixed(2)} €</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BagCard
