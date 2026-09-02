#!/bin/bash
# Sauvegarde quotidienne : appelle le même endpoint que le bouton "Sauvegarde"
# du site (/api/backup/export), décompresse le résultat dans un clone local
# du dépôt GitHub "Backup" (partagé entre plusieurs projets, un
# sous-dossier "randonnees/" par projet), commit et push si ça a changé.
#
# Pensé pour tourner via cron, ex (crontab -e) :
#   0 3 * * * /chemin/vers/randonnees/scripts/daily_backup.sh >> /chemin/vers/randonnees-backup.log 2>&1
# (chemins à adapter à l'installation : cron n'accepte pas de chemin relatif)
#
# Toute la config (domaine du site, dossier de travail...) vient de .env, à
# côté de docker-compose.yml : rien de propre à cette machine n'est en dur
# dans ce script, donc il tourne tel quel sur n'importe quelle installation.
#
# Variables requises dans .env :
#   BACKUP_SITE_URL : URL publique du site, ex https://mondomaine.example.com
#   BACKUP_ACCOUNT_EMAIL / BACKUP_ACCOUNT_PASSWORD : compte utilisé pour
#     s'authentifier auprès de l'API (comme n'importe quel compte créé via
#     la page Connexion du site).
#   GITHUB_BACKUP_TOKEN : token GitHub (accès en écriture au repo ci-dessous
#     uniquement) - jamais commité, ajouté à la main dans .env sur le serveur.
#   GITHUB_BACKUP_REPO : "utilisateur/repo", ex "XPouPouille/Backup".
# Variable optionnelle :
#   BACKUP_REPO_DIR : dossier où cloner le repo de backup (défaut : à côté du
#     projet, "../randonnees-backups-repo" relatif à ce script).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${BACKUP_ENV_FILE:-$PROJECT_DIR/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier .env introuvable : $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

for var in BACKUP_SITE_URL BACKUP_ACCOUNT_EMAIL BACKUP_ACCOUNT_PASSWORD GITHUB_BACKUP_TOKEN GITHUB_BACKUP_REPO; do
  if [ -z "${!var:-}" ]; then
    echo "$var manquant dans $ENV_FILE" >&2
    exit 1
  fi
done

BACKUP_REPO_DIR="${BACKUP_REPO_DIR:-$PROJECT_DIR/../randonnees-backups-repo}"
BACKUP_SUBDIR="randonnees"

TOKEN=$(curl -sf -X POST "$BACKUP_SITE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BACKUP_ACCOUNT_EMAIL\",\"password\":\"$BACKUP_ACCOUNT_PASSWORD\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

TMP_ZIP=$(mktemp --suffix=.zip)
trap 'rm -f "$TMP_ZIP"' EXIT

curl -sf "$BACKUP_SITE_URL/api/backup/export" -H "Authorization: Bearer $TOKEN" -o "$TMP_ZIP"

mkdir -p "$BACKUP_REPO_DIR"
cd "$BACKUP_REPO_DIR"
if [ ! -d .git ]; then
  git clone "https://${GITHUB_BACKUP_TOKEN}@github.com/${GITHUB_BACKUP_REPO}.git" .
fi
git pull --quiet origin main || true

rm -rf "$BACKUP_SUBDIR"
mkdir -p "$BACKUP_SUBDIR"
python3 -c "import zipfile; zipfile.ZipFile('$TMP_ZIP').extractall('$BACKUP_SUBDIR')"

git add "$BACKUP_SUBDIR"
if git diff --cached --quiet; then
  echo "$(date -Iseconds) rien de nouveau à sauvegarder"
  exit 0
fi

git -c user.email="backup@randonnees.local" -c user.name="Randonnees Backup Bot" \
  commit -q -m "randonnees: backup $(date +%Y-%m-%d)"
git push --quiet origin main
echo "$(date -Iseconds) backup poussé sur $GITHUB_BACKUP_REPO"
