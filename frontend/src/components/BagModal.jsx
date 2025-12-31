import React, { useState } from 'react'
import { X, Trash2, Image as ImageIcon, Clock, CheckCircle2, TrendingUp, Plus, Loader2, Camera } from 'lucide-react'
import BeforeAfterSlider from './BeforeAfterSlider'
import BagLog from './BagLog'
import BagConsumables from './BagConsumables'

const STATUSES = {
    to_be_cleaned: { label: 'À nettoyer', color: '#666', icon: <Clock size={16} /> },
    cleaning: { label: 'Nettoyage', color: '#3498db', icon: <Clock size={16} /> },
    repairing: { label: 'Réparation', color: '#e67e22', icon: <Clock size={16} /> },
    drying: { label: 'Séchage', color: '#1abc9c', icon: <Clock size={16} /> },
    ready_for_sale: { label: 'Prêt à la vente', color: '#9b59b6', icon: <CheckCircle2 size={16} /> },
    selling: { label: 'En vente', color: '#f1c40f', icon: <TrendingUp size={16} /> },
    sold: { label: 'Vendu', color: '#2ecc71', icon: <CheckCircle2 size={16} /> }
}

function BagModal({
    show,
    onClose,
    selectedBag,
    formData,
    setFormData,
    handleSubmit,
    handleDelete,
    onImageAdd,
    onImageDelete,
    brands = [],
    onAddBrand,
    authenticatedFetch
}) {
    const [uploading, setUploading] = useState(false)
    const [imageType, setImageType] = useState('other')
    const [viewImage, setViewImage] = useState(null)

    if (!show) return null

    const handleFileChange = async (e, type) => {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        try {
            await onImageAdd(file, type)
        } finally {
            setUploading(false)
        }
    }

    // Helper to filter images by type
    const getImagesByType = (type) => formData.images?.filter(img => (img.type || 'other') === type) || []

    // Get primary before/after images for slider
    const beforeImg = getImagesByType('before')[0]
    const afterImg = getImagesByType('after')[0]

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>{selectedBag ? 'Modifier le sac' : 'Nouveau sac'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                {/* ImageViewer Modal */}
                {viewImage && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.9)',
                        zIndex: 2000,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '2rem'
                    }} onClick={() => setViewImage(null)}>
                        <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                            <img src={viewImage.url} alt="Full View" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
                            <button
                                onClick={() => setViewImage(null)}
                                style={{
                                    position: 'absolute', top: '-40px', right: '-40px',
                                    background: 'white', border: 'none', borderRadius: '50%',
                                    width: '32px', height: '32px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Avant/Après Slider Visualization */}
                {beforeImg && afterImg && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <BeforeAfterSlider beforeImage={beforeImg} afterImage={afterImg} />
                    </div>
                )}

                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const brandExists = brands.some(b => b.name.toLowerCase() === formData.brand.toLowerCase());
                    if (formData.brand && !brandExists) {
                        await onAddBrand(formData.brand);
                    }
                    handleSubmit(e);
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label>Modèle</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="ex: Kelly 32" required />
                        </div>
                        <div className="form-group">
                            <label>Marque</label>
                            <input
                                type="text"
                                list="brands-list"
                                value={formData.brand}
                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                placeholder="ex: Hermès"
                            />
                            <datalist id="brands-list">
                                {brands.map(brand => (
                                    <option key={brand.id} value={brand.name} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Statut de rénovation</label>
                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                            {Object.entries(STATUSES).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Image Management Section */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Photos de Rénovation</label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* Before Images */}
                            <div style={{ border: '1px dashed #ccc', padding: '1rem', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#e67e22' }}>AVANT</span>
                                    <label style={{ cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Plus size={14} /> Ajouter
                                        <input type="file" onChange={(e) => handleFileChange(e, 'before')} disabled={uploading} accept="image/*" style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '0.5rem' }}>
                                    {getImagesByType('before').map((img, index) => (
                                        <div key={img.id || index} style={{ position: 'relative', height: '60px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}>
                                            <img
                                                src={img.url}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                alt="Before"
                                                onClick={() => setViewImage(img)}
                                            />
                                            <button type="button" onClick={(e) => { e.stopPropagation(); onImageDelete(img); }} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '2px', cursor: 'pointer' }}><X size={12} /></button>
                                        </div>
                                    ))}
                                    {getImagesByType('before').length === 0 && <span style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>Aucune photo</span>}
                                </div>
                            </div>

                            {/* After Images */}
                            <div style={{ border: '1px dashed #ccc', padding: '1rem', borderRadius: '8px', background: '#fafafa' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#2ecc71' }}>APRÈS</span>
                                    <label style={{ cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Plus size={14} /> Ajouter
                                        <input type="file" onChange={(e) => handleFileChange(e, 'after')} disabled={uploading} accept="image/*" style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '0.5rem' }}>
                                    {getImagesByType('after').map((img, index) => (
                                        <div key={img.id || index} style={{ position: 'relative', height: '60px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}>
                                            <img
                                                src={img.url}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                alt="After"
                                                onClick={() => setViewImage(img)}
                                            />
                                            <button type="button" onClick={(e) => { e.stopPropagation(); onImageDelete(img); }} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '2px', cursor: 'pointer' }}><X size={12} /></button>
                                        </div>
                                    ))}
                                    {getImagesByType('after').length === 0 && <span style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>Aucune photo</span>}
                                </div>
                            </div>
                        </div>

                        {/* Other Images */}
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Autres Photos / Général</span>
                                <label style={{ cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Plus size={14} /> Ajouter
                                    <input type="file" onChange={(e) => handleFileChange(e, 'other')} disabled={uploading} accept="image/*" style={{ display: 'none' }} />
                                </label>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem' }}>
                                {getImagesByType('other').map((img, index) => (
                                    <div key={img.id || index} style={{ position: 'relative', height: '80px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}>
                                        <img
                                            src={img.url}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt="Other"
                                            onClick={() => setViewImage(img)}
                                        />
                                        <button type="button" onClick={(e) => { e.stopPropagation(); onImageDelete(img); }} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '2px', cursor: 'pointer' }}><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Provenance / Lieu d'achat</label>
                            <input
                                type="text"
                                value={formData.purchase_source || ''}
                                onChange={e => setFormData({ ...formData, purchase_source: e.target.value })}
                                placeholder="ex: Vinted, Vide-grenier, Don..."
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
                                <input
                                    type="checkbox"
                                    checked={!!formData.is_donation}
                                    onChange={e => setFormData({ ...formData, is_donation: e.target.checked ? 1 : 0 })}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <span>C'est un don</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <div className="form-group">
                            <label>Achat (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.is_donation ? 0 : formData.purchase_price}
                                onChange={e => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                                disabled={!!formData.is_donation}
                                style={formData.is_donation ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                            />
                        </div>
                        <div className="form-group">
                            <label>Vente Est. (€)</label>
                            <input type="number" step="0.01" value={formData.target_resale_price} onChange={e => setFormData({ ...formData, target_resale_price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="form-group">
                            <label>Coût Matériel (€)</label>
                            <input type="number" step="0.01" value={formData.material_costs} onChange={e => setFormData({ ...formData, material_costs: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>

                    {formData.status === 'sold' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#eafaf1', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label>Vente Réelle (€)</label>
                                <input type="number" step="0.01" value={formData.actual_resale_price} onChange={e => setFormData({ ...formData, actual_resale_price: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="form-group">
                                <label>Frais Plateforme (€)</label>
                                <input type="number" step="0.01" value={formData.fees} onChange={e => setFormData({ ...formData, fees: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Notes & État</label>
                        <textarea rows="3" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Détails sur les réparations à prévoir..."></textarea>
                    </div>

                    {selectedBag && (
                        <>
                            <BagConsumables
                                bagId={selectedBag.id}
                                authenticatedFetch={authenticatedFetch}
                                onUpdateCost={(costDiff) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        material_costs: Math.max(0, (prev.material_costs || 0) + costDiff)
                                    }));
                                }}
                            />
                            <BagLog bagId={selectedBag.id} authenticatedFetch={authenticatedFetch} />
                        </>
                    )}

                    <div className="modal-actions" style={{ marginTop: '2rem' }}>
                        {selectedBag && (
                            <button type="button" className="btn-secondary" style={{ marginRight: 'auto', color: '#e74c3c' }} onClick={() => handleDelete(selectedBag.id)}>
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn-primary">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default BagModal
