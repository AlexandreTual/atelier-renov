# Audit Complet — Atelier Rénov'

**Date :** 2026-02-28
**Branche :** feat/phase2-performance-charts (pré-merge)
**Périmètre :** backend/server.js, frontend complet, CI/CD, infra

Légende : 🔴 Critique · 🟠 Élevé · 🟡 Moyen · 🟢 Faible

---

## 1. Sécurité

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| S1 | 🟡 | **CSV injection** : les champs `brand`, `name` ne sont pas échappés dans l'export CSV (`;` dans un nom casse le fichier) | `server.js:996-1005` |
| S2 | 🟡 | **JWT 7 jours** : durée trop longue pour une app financière ; en cas de vol du device, l'accès dure une semaine | `server.js:483` |
| S3 | 🟡 | **Mismatch validation password** : frontend autorise ≥ 4 chars, backend exige ≥ 8 | `SettingsTab.jsx:20, server.js:496` |
| S4 | 🟡 | **Message login trop précis** : "Mot de passe incorrect" confirme l'existence du compte | `server.js:486` |
| S5 | 🟡 | **JWT dans localStorage** : accessible par tout script de la même origine (XSS → token volé) | `useAuth.js:4,7` |
| S6 | 🟡 | **Pas de CSRF protection** : opérations POST/PUT/DELETE sans token CSRF | global |
| S7 | 🟡 | **Logs avec headers** : pinoHttp logue les headers Authorization → token visible dans les logs | `server.js:84` |
| S8 | 🟢 | **Erreurs migration silencieuses** : `catch(e) { /* ignore */ }` avale tout ; erreur non-idempotente invisible | `server.js:370, 380` |
| S9 | 🟢 | **URL Koyeb hardcodée** dans `vercel.json` — si le backend change d'URL, redeploy frontend nécessaire | `vercel.json:5` |

> **Note :** XSS direct impossible — React échappe les valeurs JSX par défaut. L'injection SQL est correctement protégée par les requêtes paramétrées.

---

## 2. UX / Accessibilité

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| U1 | 🟠 | **Bouton export CSV cliquable plusieurs fois** : pas de `disabled` pendant le fetch, toast dupliqués | `BusinessTab.jsx:54-76` |
| U2 | 🟠 | **Perte formulaire si upload image échoue** : pas de rollback visuel, données saisies perdues | `BagModal.jsx:60-69` |
| U3 | 🟡 | **`confirm()` natif** pour les suppressions : non stylisable, UX cassée sur mobile, non bloquant | partout (`handleDelete`) |
| U4 | 🟡 | **Label "Quantité" incorrect** dans ConsumablesTab : affiche le %, devrait être "Stock disponible" | `ConsumablesTab.jsx:158` |
| U5 | 🟡 | **Pas de compteur de résultats** après filtrage inventaire (ex. "12 articles trouvés") | `App.jsx:243-257` |
| U6 | 🟡 | **Pas d'accessibilité ARIA** : modales sans `role="dialog"`, images sans `alt` dans les thumbnails | global |
| U7 | 🟡 | **Pas de mode sombre** (`prefers-color-scheme` ignoré) | `index.css:1-16` |
| U8 | 🟡 | **Formulaire non responsive** : grille 3 colonnes (`1fr 1fr 1fr`) casse sur mobile étroit | `BagModal.jsx:139, 317` |
| U9 | 🟡 | **Champ `listing_url` masqué si statut ≠ `ready_for_sale`/`selling`** : URL déjà enregistrée invisible en statut `sold` | `BagModal.jsx:413` |
| U10 | 🟡 | **Pas de raccourcis clavier** (Echap pour fermer modal fonctionne, pas de Cmd+K search, etc.) | global |
| U11 | 🟢 | **Empty states inconsistants** : styles et messages différents selon les onglets | `App.jsx:166, 260` |
| U12 | 🟢 | **Graphique non exportable** (print/PNG) | `PerformanceChart.jsx` |

---

## 3. Fonctionnalités

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| F1 | 🔴 | **Race condition stock consommable** : 2 requêtes simultanées POST `/api/bags/:id/consumables` peuvent décrémenter le stock sous zéro | `server.js:674-687` |
| F2 | 🟠 | **Reorder liste dashboard non atomique** : mise à jour optimiste → si l'API échoue, état local diverge | `useDashboardListActions.js:45-79` |
| F3 | 🟡 | **Pas de validation URL `listing_url`** : `type="url"` HTML mais pas de contrôle backend | `BagModal.jsx:437, server.js:569` |
| F4 | 🟡 | **Suppression marque/type sans vérification** : on peut supprimer une marque encore utilisée par des articles | `server.js:1071-1077` |
| F5 | 🟡 | **`remaining_percentage` peut aller < 0** côté backend (PUT consumables sans clamp) | `server.js:865` |
| F6 | 🟡 | **Fiche Vinted sans fallback clipboard** : `navigator.clipboard` non disponible sur HTTP ou anciens navigateurs | `BagModal.jsx:421-424` |
| F7 | 🟡 | **Pas de recherche sur les consommables** ni sur les dépenses | `ConsumablesTab.jsx, BusinessTab.jsx` |
| F8 | 🟡 | **Pas de tri sur les dépenses** : affichage dans l'ordre d'insertion | `BusinessTab.jsx:128-153` |
| F9 | 🟡 | **`time_spent` en base mais jamais affiché** ni éditable dans l'interface | `server.js:270, BagModal.jsx` |
| F10 | 🟢 | **Graphique mensuel n'inclut pas le profit net** (profit bags − dépenses du mois) : les deux séries sont séparées | `PerformanceChart.jsx` |

---

## 4. Performance

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| P1 | 🟠 | **Pas de pagination** : GET `/api/bags` retourne 100 % des articles sans limite — crash UX au-delà de ~500 articles | `server.js:515, App.jsx:269` |
| P2 | 🟠 | **Pas de `React.memo`** sur BagCard : tous les articles re-rendent à chaque changement de filtre | `App.jsx:269-271` |
| P3 | 🟡 | **Filtre des listes dashboard côté client** : `bags.filter()` sur tous les articles à chaque render | `App.jsx:175` |
| P4 | 🟡 | **Index manquant sur `bags.created_at`** (utilisé pour le tri "date récente") | `server.js:389-394` |
| P5 | 🟡 | **Export CSV construit en mémoire** : chaîne de 10+ MB avec 10 k articles | `server.js:996-1009` |
| P6 | 🟡 | **Pas de lazy loading** sur les thumbnails dans BagModal | `BagModal.jsx:199-262` |
| P7 | 🟢 | **Deux requêtes pour les stats mensuelles** (ventes + dépenses séparées) — pourrait être une UNION | `server.js:959-962` |

---

## 5. Qualité du code

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| Q1 | 🟠 | **server.js monolithique** (1 137 lignes) : routes, DB, auth, upload, migrations dans un seul fichier | `server.js` entier |
| Q2 | 🟠 | **Pas de TypeScript** : bugs de type silencieux (`string` vs `number` sur les prix) | global |
| Q3 | 🟠 | **Couverture de tests insuffisante** : tests backend couvrent seulement health/auth/bags ; zéro test sur consumables, expenses, stats | `backend/tests/` |
| Q4 | 🟡 | **Messages d'erreur bilingues** : mix FR/EN entre backend et frontend | global |
| Q5 | 🟡 | **Nombres magiques** : limites upload, rate limiting, fenêtres de temps en dur dans le code | `server.js:99, 457, 462, 464` |
| Q6 | 🟡 | **`body-parser` listé en dépendance** mais inutile (Express 5 l'inclut nativement) | `backend/package.json` |
| Q7 | 🟡 | **Couche DB non abstraite** : requêtes SQL éparpillées dans les routes, pas de modèle ou repository | `server.js` entier |
| Q8 | 🟢 | **Pas de JSDoc** sur les hooks et utilitaires | `hooks/` |

---

## 6. Infrastructure / DevOps

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| I1 | 🔴 | **Pas de `.env.example`** : impossible de démarrer le projet localement sans documentation externe | manquant |
| I2 | 🟠 | **Migrations sans versioning** : pas de rollback possible, schema modifié sur startup | `server.js:238-429` |
| I3 | 🟠 | **Pas de stratégie de backup** : SQLite en volume Docker, PostgreSQL sans snapshot documenté | infra |
| I4 | 🟠 | **Connection pool PostgreSQL sans limite** explicite (`max`) | `server.js:248-251` |
| I5 | 🟡 | **Logs non persistés** : Pino → stdout uniquement, perdus au restart du container | `server.js:15` |
| I6 | 🟡 | **Pas de monitoring/alerting** : aucune alerte sur erreur 5xx, latence ou downtime | infra |
| I7 | 🟡 | **CI ne teste pas les routes critiques** : pas de tests d'intégration E2E | `.github/workflows/` |
| I8 | 🟢 | **Images Docker non épinglées** à un digest (non-reproductible) | `docker-compose.yml` |

---

## 7. Intégrité des données

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| D1 | 🔴 | **Pas de soft delete** : suppression définitive de tous les objets (articles, dépenses, consommables) | `server.js:579-601` |
| D2 | 🟠 | **Pas de contraintes CHECK sur les prix** : valeurs négatives acceptées en DB | `server.js:259-327` |
| D3 | 🟠 | **Arithmétique flottante** : `0.1 + 0.2 = 0.30000...4` dans les calculs de profit | `BagCard.jsx:8, App.jsx:98` |
| D4 | 🟡 | **`is_donation` stocké en INTEGER (SQLite) / BOOLEAN (PostgreSQL)** : comportement différent selon le moteur | `server.js:275, 544, 569` |
| D5 | 🟡 | **Pas de FK entre `bag_consumables` et `consumables`** : liens orphelins possibles | `server.js:358-367` |
| D6 | 🟡 | **Pas de contrainte `NOT NULL`** sur `purchase_price`, `actual_resale_price`, `fees` | `server.js:264-271` |
| D7 | 🟡 | **Format de dates hétérogène** : ISO 8601 dans certains champs, YYYY-MM-DD dans d'autres | `server.js:268, 897` |
| D8 | 🟢 | **Nettoyage orphelins au démarrage** uniquement : images orphelines s'accumulent entre restarts | `server.js:385-387` |

---

## 8. Logique métier

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| M1 | 🟡 | **Marge calculée différemment** dans BagCard, BagModal et BusinessTab : pas de fonction centralisée | `BagCard.jsx:8, BagModal.jsx:290, BusinessTab.jsx:79` |
| M2 | 🟡 | **Frais plateforme (`fees`) non inclus** dans le profit estimé des articles non vendus | `BagCard.jsx:9` |
| M3 | 🟡 | **Pas de statut "archivé"** : les articles vendus restent dans l'inventaire principal | `constants.jsx` |
| M4 | 🟡 | **`time_spent` jamais utilisé** dans les calculs (coût horaire potentiel ignoré) | `server.js:270` |
| M5 | 🟢 | **CA mensuel n'inclut pas le profit net** (CA − coûts articles − dépenses du mois) dans le graphique | `PerformanceChart.jsx` |
| M6 | 🟢 | **Pas d'indication de performance** par type d'article ou marque (analytics croisés) | backlog |

---

## Récapitulatif

| Volet | 🔴 | 🟠 | 🟡 | 🟢 | Total |
|-------|----|----|----|----|-------|
| Sécurité | 0 | 0 | 7 | 2 | **9** |
| UX | 0 | 2 | 7 | 3 | **12** |
| Fonctionnalités | 1 | 1 | 7 | 1 | **10** |
| Performance | 0 | 2 | 4 | 1 | **7** |
| Code | 0 | 3 | 4 | 1 | **8** |
| Infra | 1 | 3 | 3 | 1 | **8** |
| Données | 2 | 2 | 4 | 1 | **9** |
| Métier | 0 | 0 | 4 | 2 | **6** |
| **Total** | **4** | **13** | **40** | **12** | **69** |

---

## Priorités recommandées

### Critique — à traiter en priorité
- D1 · Soft delete (données perdues définitivement)
- D2 · Contraintes CHECK sur prix négatifs
- F1 · Race condition stock consommable
- I1 · Ajouter `.env.example`

### Élevé — prochain sprint
- P1 · Pagination GET `/api/bags`
- P2 · `React.memo(BagCard)`
- S3 · Aligner validation password frontend/backend
- I2 · Migrer vers migrations versionnées (Knex)
- I3 · Documenter/automatiser backup DB
- D3 · Centraliser calculs financiers (prépare fix flottants)

### Moyen — backlog
- S1 · Échapper CSV export
- S2 · Réduire durée JWT
- U1 · Désactiver bouton export pendant fetch
- U3 · Modale de confirmation custom (remplace `confirm()`)
- F4 · Vérifier usage avant suppression marque/type
- Q1 · Découper server.js en modules (routes/, services/)
- M1 · Centraliser `calculateProfit()` et `calculateMargin()`
