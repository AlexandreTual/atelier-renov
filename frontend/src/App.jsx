import React, { useState, useEffect } from 'react'
import { Clock, Plus, Settings, ChevronUp, ChevronDown } from 'lucide-react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import StatCard from './components/StatCard'
import BagCard from './components/BagCard'
import BagModal from './components/BagModal'
import Login from './components/Login'
import DashboardListModal from './components/DashboardListModal'
import ConsumablesTab from './components/ConsumablesTab'
import BusinessTab from './components/BusinessTab'
import SettingsTab from './components/SettingsTab'
import { Toaster } from 'react-hot-toast'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useProjectData } from './hooks/useProjectData'
import { useBagActions } from './hooks/useBagActions'
import { useDashboardListActions } from './hooks/useDashboardListActions'
import { useBrandActions } from './hooks/useBrandActions'

function App() {
  const { token, authenticatedFetch, login, logout } = useAuth()
  const {
    bags, dashboardLists, setDashboardLists, consumables, expenses, brands,
    fetchBags, fetchDashboardLists, fetchConsumables, fetchExpenses, fetchBrands, fetchAll
  } = useProjectData(authenticatedFetch)

  // UI state
  const [showModal, setShowModal] = useState(false)
  const [selectedBag, setSelectedBag] = useState(null)
  const [formData, setFormData] = useState({
    name: '', brand: '', purchase_price: 0, target_resale_price: 0,
    actual_resale_price: 0, status: 'to_be_cleaned', fees: 0,
    material_costs: 0, notes: '', purchase_source: '', is_donation: 0, images: []
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [showListModal, setShowListModal] = useState(false)
  const [selectedList, setSelectedList] = useState(null)

  // Actions
  const { handleImageAdd, handleImageDelete, handleSubmit, handleDelete } = useBagActions(authenticatedFetch, fetchBags)
  const { handleSaveList, handleDeleteList, handleReorderList } = useDashboardListActions(authenticatedFetch, fetchDashboardLists)
  const { handleAddBrand } = useBrandActions(authenticatedFetch, fetchBrands)

  useEffect(() => {
    if (token) {
      fetchAll()
    }
  }, [token, fetchAll])

  const openModal = (bag = null) => {
    if (bag) {
      setSelectedBag(bag)
      setFormData({ ...bag, images: bag.images || [] })
    } else {
      setSelectedBag(null)
      setFormData({
        name: '', brand: '', purchase_price: 0, target_resale_price: 0,
        actual_resale_price: 0, status: 'to_be_cleaned', fees: 0,
        material_costs: 0, notes: '', purchase_source: '', is_donation: 0, images: []
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedBag(null)
  }

  // Stats calculations
  const totalProfit = bags.reduce((acc, bag) => {
    if (bag.status === 'sold') {
      return acc + (bag.actual_resale_price - bag.purchase_price - (bag.fees || 0) - (bag.material_costs || 0))
    }
    return acc
  }, 0)

  const activeRenovations = bags.filter(b => ['cleaning', 'repairing', 'drying'].includes(b.status)).length
  const stockValueEst = bags.filter(b => b.status !== 'sold').reduce((acc, b) => acc + (b.target_resale_price || 0), 0)
  const capitalImmobilized = bags.filter(b => b.status !== 'sold').reduce((acc, b) => acc + (b.purchase_price || 0) + (b.material_costs || 0), 0)

  if (!token) {
    return <Login onLogin={login} />
  }

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      <Sidebar onLogout={logout} />

      <main className="main-content">
        <Header onAddNew={() => openModal()} />

        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />

          <Route path="/dashboard" element={
            <section className="dashboard">
              <div className="stats-grid">
                <StatCard label="Bénéfice Réalisé" value={`${totalProfit.toFixed(2)} €`} className="profit" />
                <StatCard label="En cours de soin" value={activeRenovations} />
                <StatCard label="Valeur Stock (Est.)" value={`${stockValueEst.toFixed(2)} €`} />
                <StatCard label="Capital Immobilisé" value={`${capitalImmobilized.toFixed(2)} €`} style={{ color: 'var(--accent-brown)' }} />
              </div>

              <div style={{ marginTop: '3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Clock size={24} /> Mes Listes
                  </h2>
                  <button
                    onClick={() => { setSelectedList(null); setShowListModal(true); }}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                  >
                    <Plus size={18} /> Nouvelle liste
                  </button>
                </div>

                {dashboardLists.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', background: '#f9f9f9', borderRadius: '12px', color: '#666' }}>
                    <p>Vous n'avez pas encore de listes personnalisées.</p>
                    <button onClick={() => { setSelectedList(null); setShowListModal(true); }} style={{ marginTop: '1rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Créer ma première liste
                    </button>
                  </div>
                )}

                {dashboardLists.map((list, index) => {
                  const filteredBags = bags.filter(b => list.filters.includes(b.status))
                  return (
                    <div key={list.id} style={{ marginBottom: '3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>{list.title} ({filteredBags.length})</h3>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => handleReorderList(list.id, 'up', dashboardLists, setDashboardLists)} disabled={index === 0} style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', color: index === 0 ? '#eee' : '#999', padding: '2px' }}>
                            <ChevronUp size={18} />
                          </button>
                          <button onClick={() => handleReorderList(list.id, 'down', dashboardLists, setDashboardLists)} disabled={index === dashboardLists.length - 1} style={{ background: 'none', border: 'none', cursor: index === dashboardLists.length - 1 ? 'default' : 'pointer', color: index === dashboardLists.length - 1 ? '#eee' : '#999', padding: '2px' }}>
                            <ChevronDown size={18} />
                          </button>
                        </div>
                        <button onClick={() => { setSelectedList(list); setShowListModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}>
                          <Settings size={16} />
                        </button>
                      </div>
                      <div className="inventory-grid">
                        {filteredBags.map(bag => (
                          <BagCard key={bag.id} bag={bag} onClick={() => openModal(bag)} />
                        ))}
                        {filteredBags.length === 0 && (
                          <p style={{ color: '#999', fontStyle: 'italic', gridColumn: '1 / -1' }}>Aucun sac ne correspond à ces critères.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          } />

          <Route path="/inventory" element={
            <section>
              <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                <input
                  type="text"
                  placeholder="Rechercher un modèle ou une marque..."
                  className="search-input"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                />
                <select
                  value={brandFilter}
                  onChange={e => setBrandFilter(e.target.value)}
                  style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', minWidth: '150px' }}
                >
                  <option value="all">Toutes les marques</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="inventory-grid">
                {bags
                  .filter(bag => {
                    const matchSearch = bag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (bag.brand && bag.brand.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchBrand = brandFilter === 'all' || bag.brand === brandFilter;
                    return matchSearch && matchBrand;
                  })
                  .map(bag => (
                    <BagCard key={bag.id} bag={bag} onClick={() => openModal(bag)} />
                  ))
                }
              </div>
            </section>
          } />

          <Route path="/stocks" element={
            <ConsumablesTab
              consumables={consumables}
              fetchConsumables={fetchConsumables}
              authenticatedFetch={authenticatedFetch}
            />
          } />

          <Route path="/business" element={
            <BusinessTab
              expenses={expenses}
              bags={bags}
              fetchExpenses={fetchExpenses}
              authenticatedFetch={authenticatedFetch}
            />
          } />

          <Route path="/settings" element={
            <SettingsTab
              authenticatedFetch={authenticatedFetch}
            />
          } />
        </Routes>

        <BagModal
          show={showModal}
          onClose={closeModal}
          selectedBag={selectedBag}
          formData={formData}
          setFormData={setFormData}
          handleSubmit={(e) => { e.preventDefault(); handleSubmit(formData, selectedBag, closeModal); }}
          handleDelete={(id) => handleDelete(id, closeModal)}
          onImageAdd={(file, type) => handleImageAdd(file, type, selectedBag, setFormData)}
          onImageDelete={(img) => handleImageDelete(img, setFormData)}
          brands={brands}
          onAddBrand={handleAddBrand}
          authenticatedFetch={authenticatedFetch}
        />

        <DashboardListModal
          show={showListModal}
          onClose={() => setShowListModal(false)}
          selectedList={selectedList}
          onSave={(data) => handleSaveList(data, setShowListModal)}
          onDelete={(id) => handleDeleteList(id, setShowListModal)}
        />
      </main>
    </div>
  )
}

export default App
