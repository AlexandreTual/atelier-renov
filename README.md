# Atelier Rénov' - Gestion de Rénovation de Sacs 👜

Une application élégante pour suivre l'achat, la rénovation et la revente de sacs à main de luxe.

## 🚀 Lancement rapide avec Docker

Pour lancer l'application, assurez-vous d'avoir Docker et Docker Compose installés, puis lancez :

```bash
docker-compose up --build
```

L'application sera accessible sur :
- **Frontend** : [http://localhost:8080](http://localhost:8080)
- **API Backend** : [http://localhost:5000/api](http://localhost:5000/api)

## ✨ Fonctionnalités

- **Tableau de bord** : Vue globale de la rentabilité, du stock et des rénovations en cours.
- **Suivi de Pipeline** : États de rénovation (Nettoyage, Réparation, Séchage, etc.).
- **Calcul de rentabilité** : Prise en compte du prix d'achat, des coûts de matériel, des frais de plateforme et du prix de vente final.
- **Inventaire** : Liste complète de tous les sacs traités ou en stock.

## 🛠️ Stack Technique

- **Frontend** : React + Vite + Vanilla CSS (Design Premium)
- **Backend** : Node.js + Express
- **Base de données** : SQLite (persistance via volume Docker)
- **Conteneurisation** : Docker & Docker Compose
