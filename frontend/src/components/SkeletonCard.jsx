import React from 'react'

function SkeletonCard() {
  return (
    <div className="bag-card" style={{ pointerEvents: 'none' }}>
      <div className="skeleton" style={{ height: '200px' }} />
      <div className="bag-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: '12px', width: '40%', marginBottom: '0.5rem' }} />
            <div className="skeleton" style={{ height: '16px', width: '70%' }} />
          </div>
          <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
            <div className="skeleton" style={{ height: '10px', width: '50px', marginBottom: '0.4rem' }} />
            <div className="skeleton" style={{ height: '18px', width: '64px' }} />
          </div>
        </div>
        <div className="bag-prices">
          <div className="price-item">
            <div className="skeleton" style={{ height: '10px', width: '36px', marginBottom: '0.3rem' }} />
            <div className="skeleton" style={{ height: '14px', width: '48px' }} />
          </div>
          <div className="price-item">
            <div className="skeleton" style={{ height: '10px', width: '48px', marginBottom: '0.3rem' }} />
            <div className="skeleton" style={{ height: '14px', width: '56px' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SkeletonCard
