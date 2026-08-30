#!/bin/bash
# Sauvegarde quotidienne : appelle le même endpoint que le bouton "Sauvegarde"
# du site (/api/backup/export), décompresse le résultat dans un clone local
# du dépôt GitHub "Backup" (partagé entre plusieurs projets, un
# sous-dossier "randonnees/" par projet), commit et push si ça a changé.
#
# Pensé pour tourner via cron sur le Pi, ex (crontab -e) :
#   0 3 * * * /home/xavier/randonnees/scripts/daily_backup.sh >> /home/xavier/randonnees-backup.log 2>&1
#
# Variables requises dans .env (à côté de docker-compose.yml) :
#   BACKUP_ACCOUNT_EMAIL / BACKUP_ACCOUNT_PASSWORD : compte utilisé pour
#     s'authentifier auprès de l'API (comme n'importe quel compte créé via
#     la page Connexion du site).
#   GITHUB_BACKUP_TOKEN : token GitHub (accès en écriture au repo ci-dessous
#     uniquement) - jamais commité, ajouté à la main dans .env sur le Pi.
#   GITHUB_BACKUP_REPO : "utilisateur/repo", ex "XPouPouille/Backup".

set -euo pipefail

SITE_URL="${BACKUP_SITE_URL:-https://randonnees.ia.xavierchapouille.ddns.net}"
BACKUP_REPO_DIR="${BACKUP_REPO_DIR:-/home/xavier/randonnees-backups-repo}"
BACKUP_SUBDIR="randonnees"
ENV_FILE="${BACKUP_ENV_FILE:-/home/xavier/randonnees/.env}"

set -a
source "$ENV_FILE"
set +a

for var in BACKUP_ACCOUNT_EMAIL BACKUP_ACCOUNT_PASSWORD GITHUB_BACKUP_TOKEN GITHUB_BACKUP_REPO; do
  if [ -z "${!var:-}" ]; then
    echo "$var manquant dans $ENV_FILE" >&2
    exit 1
  fi
done

TOKEN=$(curl -sf -X POST "$SITE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BACKUP_ACCOUNT_EMAIL\",\"password\":\"$BACKUP_ACCOUNT_PASSWORD\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

TMP_ZIP=$(mktemp --suffix=.zip)
trap 'rm -f "$TMP_ZIP"' EXIT

curl -sf "$SITE_URL/api/backup/export" -H "Authorization: Bearer $TOKEN" -o "$TMP_ZIP"

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
