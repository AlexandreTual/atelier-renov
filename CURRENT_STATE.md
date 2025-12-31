# État Actuel du Projet - Atelier Rénov

Ce document récapitule les fonctionnalités déjà implémentées dans l'application.

## 🏗️ Architecture Technique
- [x] Backend : Node.js (Express)
- [x] Base de données : SQLite
- [x] Frontend : React (Vite)
- [x] **Refactoring technique** : Utilisation de Custom Hooks pour la logique métier
- [x] **Navigation** : Routage via React Router (URLs uniques par section)
- [x] Authentification : Token JWT avec mot de passe haché (Bcrypt) en base de données
- [x] Stockage images : Local (`/uploads`) avec redimensionnement automatique en WebP (Sharp)
- [x] **Notifications** : Système de Toasts (react-hot-toast) pour le feedback utilisateur
- [x] Containerisation : Docker & Docker Compose

## 👜 Gestion de l'Inventaire (Sacs)
- [x] Création / Édition / Suppression de sacs
- [x] Statuts de suivi (En attente, Nettoyage, Réparation, Séchage, Prêt, Vendu)
- [x] Gestion des marques (Table dédiée avec suggestions)
- [x] Détails financiers par sac (Prix d'achat, frais de port, coût matières, prix de revente ciblé/réel)
- [x] **Photos de Rénovation** : Catégorisation Avant / Après / Autre
- [x] **Slider Interactif** : Comparateur Avant/Après automatique dans la fiche du sac
- [x] **Visionneuse Photo** : Popup plein écran au clic sur les miniatures
- [x] **Journal de Bord** : Historique daté des actions effectuées sur chaque sac
- [x] Champs additionnels (Provenance, don/achat, notes)

## 📊 Dashboard & Business
- [x] KPI globaux (Bénéfice réalisé, stock estimé, capital immobilisé, rénovations en cours)
- [x] Listes personnalisables (Possibilité de créer des sections dynamiques basées sur les statuts)
- [x] Recherche et filtrage par marque
- [x] Exportation des données de vente en CSV

## 🧴 Gestion des Consommables
- [x] Inventaire des produits (teintures, nettoyants, etc.)
- [x] Suivi du niveau de stock (%)
- [x] Coût unitaire et quantité

## 💸 Pilotage Financier
- [x] Suivi des dépenses générales (outils, marketing, packaging)
- [x] Calcul du bénéfice net global (Ventes - Coûts des sacs - Dépenses générales)
- [x] **Paramètres** : Interface de changement de mot de passe sécurisée
