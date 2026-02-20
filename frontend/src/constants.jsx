import React from 'react'
import { Clock, CheckCircle2, TrendingUp } from 'lucide-react'

export const STATUSES = {
    to_be_cleaned: { label: 'À nettoyer', color: '#666', icon: <Clock size={16} /> },
    cleaning: { label: 'Nettoyage', color: '#3498db', icon: <Clock size={16} /> },
    repairing: { label: 'Réparation', color: '#e67e22', icon: <Clock size={16} /> },
    drying: { label: 'Séchage', color: '#1abc9c', icon: <Clock size={16} /> },
    ready_for_sale: { label: 'Prêt à la vente', color: '#9b59b6', icon: <CheckCircle2 size={16} /> },
    selling: { label: 'En vente', color: '#f1c40f', icon: <TrendingUp size={16} /> },
    sold: { label: 'Vendu', color: '#2ecc71', icon: <CheckCircle2 size={16} /> }
}
