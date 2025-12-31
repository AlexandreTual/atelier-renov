# Feuille de Route (Roadmap) - Atelier Rénov

Ce document liste les améliorations et nouvelles fonctionnalités prévues pour l'application.

## 🛠️ Améliorations Techniques (Fondation)
- [x] **Refactoring React** : Extraire la logique du `App.jsx` dans des hooks (`useBags`, `useAuth`)
- [x] **Routage** : Implémenter React Router pour avoir des URLs uniques par page/sac
- [x] **Système de Notifs** : Ajouter des Toasts pour confirmer les actions (succès/erreur)
- [x] **Optimisation Image** : Redimensionnement automatique des images côté serveur pour la performance
- [x] **Sécurité** : Gestion de session plus robuste et interface de changement de mot de passe

## ✨ Nouvelles Fonctionnalités
### 🎨 Atelier & Rénovation
- [x] **Slider Avant/Après** : Comparateur visuel interactif pour les fiches produits
- [x] **Journal de Bord** : Historique des étapes de soin daté pour chaque sac
- [ ] **Liaison Matières** : Déduire automatiquement le coût des consommables utilisés sur un sac
- [ ] **Générateur de Fiche Vinted** : Bouton pour copier une description optimisée pour la vente

### 📈 Business & Analyse
- [ ] **Graphiques de Performance** : Vue mensuelle du CA et des marges (Recharts)
- [ ] **Indicateurs de Rentabilité** : Calcul automatique du ROI et de la marge % par sac
- [ ] **Gestion des Listings** : Champs pour liens directs vers les annonces (Vinted, VC)
- [ ] **Alertes Stocks** : Notification visuelle quand un consommable est presque vide

### 📱 Expérience Utilisateur (UX)
- [ ] **Mode Sombre** : Alternative visuelle pour le confort
- [ ] **Recherche Avancée** : Filtrage par plage de prix, date ou niveau de rentabilité
- [ ] **Skeletons** : États de chargement élégants pour éviter les sauts d'interface

## 🌐 Expansion
- [ ] **Multi-utilisateurs** : Permettre à plusieurs artisans de partager le même inventaire
- [ ] **API Externe** : Connexion possible avec des APIs de transporteurs ou de plateformes de vente
