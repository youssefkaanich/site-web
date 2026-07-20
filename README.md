# Sopal — Suivi des commandes clients

Site web (Laravel 12 + Inertia.js + React + Tailwind CSS) qui affiche et
permet de gérer les commandes clients extraites automatiquement des mails
(voir le projet séparé `projet sopal` / dépôt `ia-agent` pour les scripts
d'extraction Python).

## Fonctionnalités

- Page `/gestion` : tableau des commandes (toutes colonnes, colonnes
  redimensionnables), ajout/modification/suppression, filtres par carte
  statistique.
- Boutons "Extraire Gmail" / "Extraire Outlook" : démarrent/arrêtent la
  surveillance continue des mails directement depuis le site (arrêt
  automatique après 1 jour de sécurité).
- Nettoyage automatique des doublons, renumérotation des ID sans trou après
  suppression, passage automatique du statut "nouvelle" → "ancienne" après
  2 jours.
- Page `/corbeille` : commandes envoyées à la corbeille (statut "ancienne"),
  restaurables à tout moment.

## Installation sur un nouveau PC

### 1. Prérequis

- PHP 8.2+, Composer
- Node.js + npm
- MySQL (XAMPP par exemple)
- Python configuré séparément pour l'extraction (voir le dépôt `ia-agent`)

### 2. Installation

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

### 3. Configuration de `.env`

Renseigner au minimum :
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sopal_commandes
DB_USERNAME=root
DB_PASSWORD=
```

### 4. Base de données

```bash
php artisan migrate
```
(crée automatiquement la table `commandes` si elle n'existe pas déjà.)

### 5. Lancer le site

```bash
php artisan serve
npm run dev
```
Puis ouvrir http://127.0.0.1:8000/gestion

### 6. Pour que les boutons "Extraire Gmail / Outlook" fonctionnent

Il faut aussi installer et configurer le projet Python séparé (voir son
README) : `SOPAL_APP_PASSWORD`, Tesseract OCR, Ollama, etc. Le chemin vers ce
dossier est codé en dur dans `app/Http/Controllers/ExtractionController.php`
(constante `DOSSIER_PYTHON`) — à adapter si le dossier change d'emplacement
sur le nouveau PC.
