# État Actuel du Projet - Atelier Rénov'

Dernière mise à jour : 2026-02-23

---

## 🔄 Session en cours

**Branche active :** `feat/phase2-performance-charts`
**Dernier commit :** `7edd309` — feat: add monthly performance chart (#50)

### Ce qui vient d'être fait
- Graphique de performance mensuelle (CA + marges) avec Recharts — PR #50 mergée
- Phase 1 quick wins : alertes stocks bas, persistance filtres (localStorage), indicateurs ROI/marge par article
- Config Claude Code ajoutée au repo (CLAUDE.md + .claude/settings.json) — PR #51 en cours

### Prochaines étapes
1. Continuer la **phase 2** depuis le backlog (ROADMAP.md — section "Business & Analyse")
   - Générateur de fiche Vinted
   - Liaison matières → déduction automatique coût consommables
   - Skeletons / états de chargement élégants
2. Merger la PR #51 (claude-config) si pas encore fait

---

---

## 🏗️ Architecture Technique

- [x] Backend : Node.js (Express) — `backend/server.js` (monofichier ~1027 lignes)
- [x] Base de données : SQLite local / PostgreSQL production (`USE_LOCAL_MODE`)
- [x] Frontend : React 19 + Vite 7, pure JavaScript
- [x] Authentification : JWT 7 jours, bcrypt, rate limiting login (10 req/15min)
- [x] Sécurité : Helmet, CORS whitelist, fail fast si secrets absents
- [x] Stockage images : local `/uploads` + Cloudinary CDN, redimensionnement Sharp → WebP
- [x] Logging : Pino structuré (LOG_LEVEL configurable)
- [x] Containerisation : Docker multi-stage, non-root user, healthcheck
- [x] CI/CD : GitHub Actions — 3 jobs requis (backend-tests, frontend-tests, frontend-build)
- [x] Auto-merge : activé sur le repo, branch protection sur master
- [x] Tests backend : Jest + Supertest + SQLite in-memory (health, auth, bags, brands)
- [x] Tests frontend : Vitest + @testing-library/react (constants, StatCard, BagCard)

---

## 👜 Gestion de l'Inventaire

- [x] CRUD articles (modèle générique : sacs, chaussures, vêtements…)
- [x] Statuts : to_be_cleaned → cleaning → repairing → drying → ready_for_sale → selling → sold
- [x] Filtres : texte, marque, statut, type d'article
- [x] Tri : date récente (défaut), date ancienne, marque A→Z, prix ↑/↓
- [x] Loading state et empty states distincts (inventaire vide vs aucun résultat)
- [x] Marques et types d'articles — référentiels avec CRUD complet
- [x] Détails financiers (achat, frais, coût matières, revente cible/réel)
- [x] Photos avant/après + "autre" avec slider comparateur et visionneuse plein écran
- [x] Journal de bord daté par article
- [x] Consommables liés par article (transactions SQL, rollback si erreur)
- [x] Foreign keys + ON DELETE CASCADE (SQLite pragma + migration PostgreSQL idempotente)

---

## 📊 Dashboard & Business

- [x] KPIs globaux : profit réalisé, stock estimé, capital immobilisé, en cours
- [x] Listes personnalisables basées sur les statuts (drag-and-drop reorder)
- [x] Exportation CSV (ventes + dépenses)
- [x] Gestion des consommables (stock, niveau restant %)
- [x] Suivi des dépenses générales
- [x] Paramètres : changement de mot de passe

---

## 🔧 Qualité Technique

- [x] N+1 queries éliminées sur GET /api/bags (JOIN + batch images)
- [x] Index sur colonnes FK (images, bag_logs, bag_consumables, bags.status, bags.brand)
- [x] Transactions SQL sur toutes les opérations impliquant plusieurs tables
- [x] Toasts d'erreur et de succès sur toutes les actions CRUD
- [x] STATUSES centralisé dans `frontend/src/constants.jsx`
- [x] Hooks custom séparés par domaine (useAuth, useProjectData, useBagActions…)
- [x] CORS strict (`===`), rate limiting global API + upload, Multer MIME whitelist (#33 #41 #42)
- [x] Validation `newPassword` ≥ 8 chars, `usage_percent` borné, `JSON.parse` try-catch (#34 #37 #38)
- [x] `resp.ok` + `toast.error` dans tous les fetches, `revokeObjectURL` après download (#35 #36 #43)
- [x] `useCallback` + deps correctes dans BagConsumables/BagLog, `|| 0` sur calculs financiers (#39 #40 #46)
- [x] Dead code supprimé, `err.message` remplacé par `'Internal server error'` (#44)
- [x] Label "Nouvel article" dans Header (#45)
