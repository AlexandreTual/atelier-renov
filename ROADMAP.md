# Feuille de Route (Roadmap) - Atelier Rénov'

---

## ✅ Infrastructure technique (terminé)

- [x] Backend : Node.js (Express) + SQLite local / PostgreSQL prod
- [x] Frontend : React 19 (Vite 7) — pure JavaScript, pas de TypeScript
- [x] Authentification : JWT 7 jours, bcrypt, rate limiting login
- [x] Sécurité : Helmet, CORS whitelist, fail fast si secrets manquants
- [x] Logging : Pino structuré (niveau configurable via LOG_LEVEL)
- [x] Docker : multi-stage build, non-root user, healthcheck, restart policy
- [x] CI/CD : GitHub Actions (backend-tests + frontend-tests + frontend-build)
- [x] Auto-merge : `gh pr merge --auto --squash` après `sleep 8`
- [x] Branch protection : 3 checks requis sur master
- [x] Tests : Jest + Supertest (backend), Vitest + @testing-library/react (frontend)

---

## ✅ Gestion de l'Inventaire (terminé)

- [x] CRUD articles (sacs, chaussures, etc.) avec statuts
- [x] Gestion des marques et types d'articles (référentiels)
- [x] Détails financiers : prix achat, frais, coût matières, prix revente cible/réel
- [x] Photos avant/après : upload → Sharp WebP → local ou Cloudinary
- [x] Slider comparateur Avant/Après interactif
- [x] Visionneuse plein écran
- [x] Journal de bord daté par article
- [x] Consommables liés par article (transactions SQL)
- [x] Filtres : recherche texte, marque, statut, type d'article
- [x] Tri : date récente/ancienne, marque A→Z, prix ↑/↓
- [x] Loading state et empty states distincts

---

## ✅ Dashboard & Business (terminé)

- [x] KPIs globaux (profit réalisé, stock estimé, capital immobilisé)
- [x] Listes personnalisables basées sur les statuts
- [x] Exportation CSV des ventes et dépenses
- [x] Gestion des consommables (stock, niveau restant, coût)
- [x] Suivi des dépenses générales
- [x] Paramètres : changement de mot de passe

---

## ✅ Qualité & Correctifs (terminé)

- [x] Éliminer N+1 queries sur GET /api/bags (JOIN + images batch)
- [x] Index sur colonnes FK
- [x] Foreign Keys + ON DELETE CASCADE (SQLite + PostgreSQL)
- [x] Transactions sur opérations consommables
- [x] Toasts d'erreur sur toutes les actions CRUD
- [x] Centraliser STATUSES (label, couleur, icône)
- [x] Supprimer labels "sac" obsolètes dans le code

---

## ✅ Sécurité & Bugs (audit 2026-02-21, terminé)

- [x] CORS : `startsWith()` → `===` pour bloquer les sous-domaines malicieux (#33)
- [x] Validation backend sur `/api/change-password` (#34)
- [x] `resp.ok` check manquant dans useProjectData.js — crash silencieux (#35)
- [x] Memory leak `createObjectURL` sans `revokeObjectURL` (#36)
- [x] `JSON.parse` sans try-catch sur dashboard-lists (#37)
- [x] `remaining_percentage` peut aller négatif (#38)
- [x] `useEffect` dépendances manquantes dans BagConsumables + BagLog (#39)
- [x] Calculs financiers non défensifs — NaN possible (#40)
- [x] Rate limiting global + strict sur `/api/upload` (#41)
- [x] Whitelist MIME type sur Multer (#42)
- [x] Toast sur erreurs de fetch silencieuses (#43)
- [x] Dead code + `err.message` exposé dans server.js (#44)
- [x] "Nouveau sac" → "Nouvel article" dans Header (#45)
- [x] `==` → `===` dans BagConsumables (#46)

---

## 💡 Fonctionnalités futures (backlog)

### Atelier & Rénovation
- [ ] **Liaison Matières** : déduire automatiquement le coût des consommables d'un article
- [ ] **Générateur de Fiche Vinted** : copier une description optimisée pour la vente

### Business & Analyse
- [ ] **Graphiques de Performance** : vue mensuelle CA et marges (Recharts)
- [ ] **Indicateurs de Rentabilité** : ROI et marge % par article
- [ ] **Gestion des Listings** : liens vers annonces Vinted, Vestiaire Collective
- [ ] **Alertes Stocks** : notification visuelle si consommable presque vide

### UX
- [ ] **Skeletons** : états de chargement élégants
- [ ] **Persistance des filtres** : localStorage pour survivre au refresh
- [ ] **Recherche Avancée** : plage de prix, date, rentabilité
- [ ] **Mode Sombre**

### SaaS — Comptes & Multi-tenancy (priorité critique)
- [ ] **Système de comptes** : remplacer l'admin unique par une table `users` multi-comptes (email + password hashé)
- [ ] **Colonne `user_id`** sur toutes les tables de données (bags, expenses, consumables, brands, item_types, dashboard_lists, images, bag_logs, bag_consumables)
- [ ] **Filtrage par `user_id`** sur tous les endpoints `/api/*` (extrait du JWT)
- [ ] **Route `POST /api/register`** avec validation email + force mot de passe
- [ ] **Script de migration DB** : ajout colonne `user_id` + backfill `user_id = 1` pour les données existantes
- [ ] **Row-level security** (PostgreSQL) : isolation stricte des données entre tenants
- [ ] **Quotas par utilisateur** : limite nb articles, stockage images (selon plan)

### SaaS — Authentification renforcée
- [ ] **Vérification email** à l'inscription (token envoyé par email, expiration 24h)
- [ ] **Flux "mot de passe oublié"** : lien de reset par email avec token temporaire
- [ ] **2FA TOTP** (optionnel) : Google Authenticator / Authy
- [ ] **Refresh tokens** : JWT courte durée + refresh token stocké en base

### SaaS — Monétisation
- [ ] **Plans tarifaires** : Free (limites strictes) / Pro / Business
  - Limites Free : ex. 20 articles, 1 Go images, pas d'export CSV
  - Limites Pro : illimité articles, 10 Go images, toutes fonctionnalités
- [ ] **Intégration Stripe** : paiement récurrent (mensuel/annuel), gestion abonnements, webhooks (paiement échoué, annulation)
- [ ] **Période d'essai** : ex. 14 jours Pro gratuit sans CB
- [ ] **Middleware de plan** : bloquer les endpoints dépassant les quotas du plan actif

### SaaS — Onboarding
- [ ] **Page de bienvenue** au premier login (checklist : ajouter un article, une marque, une dépense)
- [ ] **Données d'exemple** (optionnel au signup) pour comprendre l'outil rapidement
- [ ] **Email de bienvenue** transactionnel (SendGrid / Resend)
- [ ] **Tooltip / guide contextuel** sur les premières actions clés

### SaaS — Emails transactionnels
- [ ] Welcome à l'inscription
- [ ] Vérification email
- [ ] Reset mot de passe
- [ ] Fin de période d'essai (J-3, J-1)
- [ ] Échec de paiement Stripe
- [ ] Alerte stock bas (option notification email en plus du bandeau in-app)

### SaaS — Back-office super-admin
- [ ] **Dashboard admin** : liste des comptes, statut abonnement, usage (articles, stockage)
- [ ] **MRR / churn** : métriques revenus récurrents
- [ ] **Gestion des comptes** : suspendre, supprimer, changer de plan manuellement

### SaaS — Légal & RGPD
- [ ] **CGU / Politique de confidentialité** (page dédiée + acceptation au signup)
- [ ] **Export des données** : endpoint `GET /api/account/export` (JSON de toutes les données de l'utilisateur)
- [ ] **Suppression de compte** : cascade sur toutes les données + suppression images Cloudinary
- [ ] **Bannière cookies** si tracking/analytics activé
- [ ] **Mentions légales** (hébergeur, éditeur, contact DPO)

### Scalabilité
- [ ] **Pagination** sur GET /api/bags (performance avec 500+ articles)
