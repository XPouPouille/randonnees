# Randonnées

Application web auto-hébergée (Docker) pour cataloguer, consulter et créer des
itinéraires de randonnée.

## Fonctionnalités

- **Carte interactive** affichant toutes les randonnées de la base (fond de
  carte OpenStreetMap ou IGN : plan, photos aériennes, cartes topo SCAN).
- **Fiche détail** par randonnée : description, distance, dénivelé,
  **profil topologique** (graphique altitude / distance), trace GPX affichée
  sur la carte.
- **Liens externes multiples** par randonnée (Komoot, AllTrails, Garmin
  Connect, Visorando, ou tout autre site), ajoutables manuellement ou en
  masse depuis un fichier Excel.
- **Itinéraire vers le point de départ** : un clic ouvre Google Maps en mode
  conduite jusqu'au point de départ de la randonnée sélectionnée.
- Import initial depuis un fichier Excel de liens existants.

### Feuille de route (V2)

- Éditeur de tracé GPX directement sur fond de carte IGN : dessin, ajout de
  point intermédiaire, découpe et collage de segments de trace.
- Ajout de points d'intérêt (POI) le long d'un parcours, à la manière
  d'OnRouteMap.
- Comptes utilisateurs multiples (au lieu du token admin unique du MVP).

## Architecture

```
randonnees/
├── backend/     FastAPI + SQLAlchemy + Alembic (API REST, parsing GPX via gpxpy)
├── frontend/    React + Vite + TypeScript + Leaflet (carte, fiches, formulaire d'ajout)
├── docker-compose.yml
└── .env.example
```

- **Base de données** : PostgreSQL + PostGIS (stocke les traces en géométrie
  `LINESTRING` + le profil altimétrique en JSON).
- **Backend** : expose une API REST (`/api/hikes`, `/api/hikes/{id}/links`,
  ...). Les routes d'écriture sont protégées par un token simple envoyé dans
  l'en-tête `X-Admin-Token`.
- **Frontend** : servi par Nginx, qui fait aussi reverse-proxy vers le
  backend (`/api`, `/uploads`) pour n'exposer qu'un seul port en prod.

## Prérequis

- Docker et Docker Compose (v2, plugin `docker compose`).
- Un compte [Géoportail / IGN](https://geoservices.ign.fr/) **si** vous
  voulez utiliser des couches IGN nécessitant une clé (`IGN_MODE=key`) —
  sinon les couches libres de la Géoplateforme (`data.geopf.fr`) fonctionnent
  sans clé (`IGN_MODE=geoplateforme`, valeur par défaut).

## Installation / déploiement sur le serveur Docker

```bash
git clone https://github.com/XPouPouille/randonnees.git
cd randonnees
cp .env.example .env
# éditer .env : mots de passe DB, ADMIN_TOKEN, CORS_ORIGINS, IGN_MODE/IGN_API_KEY, FRONTEND_PORT

docker compose up -d --build
```

Le site est alors accessible sur `http://<ip-du-serveur>:${FRONTEND_PORT}`
(port 80 par défaut). Les migrations de base de données (Alembic) et
l'activation de l'extension PostGIS sont appliquées automatiquement au
démarrage du conteneur `backend`.

### Variables d'environnement (`.env`)

| Variable | Description |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Identifiants PostgreSQL |
| `DATABASE_URL` | URL SQLAlchemy vers la base (doit correspondre aux identifiants ci-dessus) |
| `ADMIN_TOKEN` | Token à saisir dans le formulaire "Ajouter une randonnée" pour publier/modifier/supprimer |
| `CORS_ORIGINS` | Origines autorisées côté API, séparées par des virgules |
| `IGN_MODE` | `geoplateforme` (par défaut, sans clé) ou `key` |
| `IGN_API_KEY` | Clé Géoportail, utilisée uniquement si `IGN_MODE=key` |
| `FRONTEND_PORT` | Port exposé sur l'hôte pour le site (défaut `80`) |

### Obtenir une clé IGN (optionnel)

1. Créer un compte sur [geoservices.ign.fr](https://geoservices.ign.fr/).
2. Créer une "clé" associée aux couches souhaitées (usage non professionnel
   gratuit dans la majorité des cas).
3. Renseigner `IGN_MODE=key` et `IGN_API_KEY=<votre_clé>` dans `.env`, puis
   reconstruire le frontend (`docker compose up -d --build frontend`), la clé
   étant injectée au moment du build.

## Mise à jour du site

```bash
cd randonnees
git pull
docker compose up -d --build
```

Les migrations de base de données s'exécutent automatiquement au démarrage
du backend (`alembic upgrade head`). Aucune action manuelle n'est requise
sauf en cas de migration nécessitant une intervention (voir le message
d'erreur du conteneur `backend` le cas échéant).

## Import initial depuis un fichier Excel

Le fichier Excel doit contenir au minimum une colonne "Nom" (ou "Name") et
une colonne "URL" (ou "Lien"/"Link"). Une colonne "Plateforme" est optionnelle
(déduite automatiquement du nom de domaine sinon : komoot, alltrails,
garmin, visorando...).

```bash
# copier le fichier dans le volume uploads du backend, puis :
docker compose cp mon_fichier.xlsx backend:/app/uploads/import.xlsx
docker compose exec backend python -m app.scripts.import_excel /app/uploads/import.xlsx
```

Cet import ne crée que les randonnées et leurs liens externes ; la trace GPX
et les détails complémentaires s'ajoutent ensuite manuellement via le site
(page "Ajouter une randonnée" → bouton d'upload GPX sur la fiche, à venir en
V2 pour l'édition, ou en recréant la fiche avec le fichier GPX dès l'ajout).

## Sauvegarde de la base de données

```bash
docker compose exec db pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql
```

Restauration :

```bash
cat backup.sql | docker compose exec -T db psql -U <POSTGRES_USER> <POSTGRES_DB>
```

## Développement local (sans Docker)

Backend :

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # ou .venv\Scripts\activate sous Windows
pip install -r requirements.txt
# démarrer une instance PostgreSQL/PostGIS locale, régler DATABASE_URL en conséquence
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend :

```bash
cd frontend
npm install
npm run dev
```

Le serveur Vite proxifie `/api` et `/uploads` vers `http://localhost:8000`
(voir `vite.config.ts`).

## Licence

MIT — voir [LICENSE](LICENSE).
