import React, { useState, useEffect, useRef } from 'react'
import { Clock, Plus, Settings, ChevronUp, ChevronDown } from 'lucide-react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import StatCard from './components/StatCard'
import BagCard from './components/BagCard'
import SkeletonCard from './components/SkeletonCard'
import { ConfirmDialog } from './components/ConfirmDialog'
import BagModal from './components/BagModal'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import DashboardListModal from './components/DashboardListModal'
import ConsumablesTab from './components/ConsumablesTab'
import BusinessTab from './components/BusinessTab'
import SettingsTab from './components/SettingsTab'
import { Toaster } from 'react-hot-toast'
import { STATUSES } from './constants'

const PAGE_SIZE = 50

// Hooks
import { useAuth } from './hooks/useAuth'
import { useProjectData } from './hooks/useProjectData'
import { useBagActions } from './hooks/useBagActions'
import { useDashboardListActions } from './hooks/useDashboardListActions'
import { useBrandActions } from './hooks/useBrandActions'
import { useItemTypeActions } from './hooks/useItemTypeActions'

function App() {
  const { token, authenticatedFetch, login, logout } = useAuth()
  const {
    bags, bagTotal, bagStats, dashboardBags,
    dashboardLists, setDashboardLists, consumables, expenses, brands, itemTypes,
    fetchBags, fetchBagStats, fetchDashboardBags, fetchDashboardLists,
    fetchConsumables, fetchExpenses, fetchBrands, fetchItemTypes, fetchAll,
    isLoading,
  } = useProjectData(authenticatedFetch)

  // UI state
  const [showModal, setShowModal] = useState(false)
  const [selectedBag, setSelectedBag] = useState(null)
  const [formData, setFormData] = useState({
    name: '', brand: '', item_type: '', purchase_price: 0, target_resale_price: 0,
    actual_resale_price: 0, status: 'to_be_cleaned', fees: 0,
    material_costs: 0, notes: '', purchase_source: '', is_donation: 0, listing_url: '', images: []
  })
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('inv_search') || '')
  const [brandFilter, setBrandFilter] = useState(() => localStorage.getItem('inv_brand') || 'all')
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('inv_status') || 'all')
  const [itemTypeFilter, setItemTypeFilter] = useState(() => localStorage.getItem('inv_type') || 'all')
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('inv_sort') || 'date_desc')
  const [inventoryPage, setInventoryPage] = useState(0)
  const [showListModal, setShowListModal] = useState(false)
  const [selectedList, setSelectedList] = useState(null)

  const searchDebounce = useRef(null)

  // Persist filter state
  useEffect(() => { localStorage.setItem('inv_brand',  brandFilter) },  [brandFilter])
  useEffect(() => { localStorage.setItem('inv_status', statusFilter) }, [statusFilter])
  useEffect(() => { localStorage.setItem('inv_type',   itemTypeFilter) }, [itemTypeFilter])
  useEffect(() => { localStorage.setItem('inv_sort',   sortBy) },        [sortBy])

  // Refetch when non-search filters / sort / page change
  useEffect(() => {
    if (!token) return
    fetchBags({ search: searchTerm, brand: brandFilter, status: statusFilter, type: itemTypeFilter, sort: sortBy, page: inventoryPage, limit: PAGE_SIZE })
  }, [brandFilter, statusFilter, itemTypeFilter, sortBy, inventoryPage, token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search — reset page then refetch
  useEffect(() => {
    localStorage.setItem('inv_search', searchTerm)
    if (!token) return
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setInventoryPage(0)
      fetchBags({ search: searchTerm, brand: brandFilter, status: statusFilter, type: itemTypeFilter, sort: sortBy, page: 0, limit: PAGE_SIZE })
    }, 300)
    return () => clearTimeout(searchDebounce.current)
  }, [searchTerm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Actions
  const { handleImageAdd, handleImageDelete, handleSubmit, handleDelete } = useBagActions(authenticatedFetch, fetchBags)
  const { handleSaveList, handleDeleteList, handleReorderList } = useDashboardListActions(authenticatedFetch, fetchDashboardLists)
  const { handleAddBrand } = useBrandActions(authenticatedFetch, fetchBrands)
  const { handleAddItemType } = useItemTypeActions(authenticatedFetch, fetchItemTypes)

  useEffect(() => {
    if (token) fetchAll()
  }, [token, fetchAll])

  const openModal = (bag = null) => {
    if (bag) {
      setSelectedBag(bag)
      setFormData({
        ...bag,
        item_type: bag.item_type || '',
        images: bag.images || [],
        purchase_price: bag.purchase_price !== undefined ? Number(bag.purchase_price).toFixed(2) : '',
        target_resale_price: bag.target_resale_price !== undefined ? Number(bag.target_resale_price).toFixed(2) : '',
        actual_resale_price: bag.actual_resale_price !== undefined ? Number(bag.actual_resale_price).toFixed(2) : '',
        fees: bag.fees !== undefined ? Number(bag.fees).toFixed(2) : '',
        material_costs: bag.material_costs !== undefined ? Number(bag.material_costs).toFixed(2) : ''
      })
    } else {
      setSelectedBag(null)
      setFormData({
        name: '', brand: '', item_type: '', purchase_price: '', target_resale_price: '',
        actual_resale_price: '', status: 'to_be_cleaned', fees: '',
        material_costs: '', time_spent: '', notes: '', purchase_source: '', is_donation: 0, listing_url: '', images: []
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedBag(null)
  }

  const { totalProfit, activeRenovations, stockValueEst, capitalImmobilized } = bagStats

  if (!token) {
    return (
      <>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login onLogin={login} />} />
        </Routes>
      </>
    )
  }

  return (
    <div className="app-container">
      <Toaster position="top-right" />
      <ConfirmDialog />
      <Sidebar onLogout={logout} />

      <main className="main-content">
        <Header onAddNew={() => openModal()} />

        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />

          <Route path="/dashboard" element={
            <section className="dashboard">
              <div className="stats-grid">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="stat-card" style={{ padding: '1.5rem' }}>
                      <div className="skeleton" style={{ height: '12px', width: '60%', marginBottom: '0.75rem' }} />
                      <div className="skeleton" style={{ height: '28px', width: '50%' }} />
                    </div>
                  ))
                ) : (
                  <>
                    <StatCard label="Bénéfice Réalisé" value={`${totalProfit.toFixed(2)} €`} className="profit" />
                    <StatCard label="En cours de soin" value={activeRenovations} />
                    <StatCard label="Valeur Stock (Est.)" value={`${stockValueEst.toFixed(2)} €`} />
                    <StatCard label="Capital Immobilisé" value={`${capitalImmobilized.toFixed(2)} €`} style={{ color: 'var(--accent-brown)' }} />
                  </>
                )}
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

                {isLoading ? (
                  <div style={{ marginBottom: '3rem' }}>
                    <div className="skeleton" style={{ height: '20px', width: '180px', marginBottom: '1rem' }} />
                    <div className="inventory-grid">
                      {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                  </div>
                ) : dashboardLists.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', background: '#f9f9f9', borderRadius: '12px', color: '#666' }}>
                    <p>Vous n'avez pas encore de listes personnalisées.</p>
                    <button onClick={() => { setSelectedList(null); setShowListModal(true); }} style={{ marginTop: '1rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Créer ma première liste
                    </button>
                  </div>
                )}

                {dashboardLists.map((list, index) => {
                  const filteredBags = dashboardBags.filter(b => list.filters.includes(b.status))
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
                          <p style={{ color: '#999', fontStyle: 'italic', gridColumn: '1 / -1' }}>Aucun article ne correspond à ces critères.</p>
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
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Rechercher un modèle ou une marque..."
                  className="search-input"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                />
                <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer' }}>
                  <option value="all">Toutes les marques</option>
                  {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
                <select value={itemTypeFilter} onChange={e => setItemTypeFilter(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer' }}>
                  <option value="all">Tous les types</option>
                  {itemTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer' }}>
                  <option value="all">Tous les statuts</option>
                  {Object.entries(STATUSES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer' }}>
                  <option value="date_desc">Plus récent</option>
                  <option value="date_asc">Plus ancien</option>
                  <option value="brand">Marque A→Z</option>
                  <option value="price_asc">Prix ↑</option>
                  <option value="price_desc">Prix ↓</option>
                </select>
              </div>
              {isLoading ? (
                <div className="inventory-grid">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : bags.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#f9f9f9', borderRadius: '12px', color: '#666' }}>
                  <p>{bagTotal === 0 && !searchTerm && brandFilter === 'all' && statusFilter === 'all' && itemTypeFilter === 'all'
                    ? "Aucun article dans l'inventaire."
                    : 'Aucun article ne correspond aux filtres sélectionnés.'}
                  </p>
                  {bagTotal === 0 && !searchTerm && brandFilter === 'all' && statusFilter === 'all' && itemTypeFilter === 'all' && (
                    <button onClick={() => openModal()} style={{ marginTop: '1rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Ajouter mon premier article
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {(searchTerm || brandFilter !== 'all' || statusFilter !== 'all' || itemTypeFilter !== 'all') && (
                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>
                      {bagTotal} article{bagTotal !== 1 ? 's' : ''} trouvé{bagTotal !== 1 ? 's' : ''}
                    </div>
                  )}
                  <div className="inventory-grid">
                    {bags.map(bag => (
                      <BagCard key={bag.id} bag={bag} onClick={() => openModal(bag)} />
                    ))}
                  </div>
                  {bagTotal > PAGE_SIZE && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                      <button
                        onClick={() => setInventoryPage(p => p - 1)}
                        disabled={inventoryPage === 0}
                        className="btn-secondary"
                        style={{ padding: '0.5rem 1.25rem' }}
                      >
                        ← Précédent
                      </button>
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>
                        Page {inventoryPage + 1} / {Math.ceil(bagTotal / PAGE_SIZE)}
                        <span style={{ marginLeft: '0.5rem', color: '#aaa' }}>({bagTotal} articles)</span>
                      </span>
                      <button
                        onClick={() => setInventoryPage(p => p + 1)}
                        disabled={(inventoryPage + 1) * PAGE_SIZE >= bagTotal}
                        className="btn-secondary"
                        style={{ padding: '0.5rem 1.25rem' }}
                      >
                        Suivant →
                      </button>
                    </div>
                  )}
                </>
              )}
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
          handleSubmit={(e) => {
            e.preventDefault();
            const cleanNumber = (val) => {
              if (typeof val === 'string') {
                val = val.replace(',', '.');
              }
              return parseFloat(val) || 0;
            };
            const cleanedData = {
              ...formData,
              purchase_price: cleanNumber(formData.purchase_price),
              target_resale_price: cleanNumber(formData.target_resale_price),
              actual_resale_price: cleanNumber(formData.actual_resale_price),
              fees: cleanNumber(formData.fees),
              material_costs: cleanNumber(formData.material_costs),
            }
            handleSubmit(cleanedData, selectedBag, closeModal);
          }}
          handleDelete={(id) => handleDelete(id, closeModal)}
          onImageAdd={(file, type) => handleImageAdd(file, type, selectedBag, setFormData)}
          onImageDelete={(img) => handleImageDelete(img, setFormData)}
          brands={brands}
          onAddBrand={handleAddBrand}
          itemTypes={itemTypes}
          onAddItemType={handleAddItemType}
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
