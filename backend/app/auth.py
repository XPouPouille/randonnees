from fastapi import Header, HTTPException, status

from app.config import settings


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """Protège les routes d'écriture (ajout/modif/suppression) avec un token simple.

    MVP mono-utilisateur: un seul token partagé (ADMIN_TOKEN), pas de vrai
    système de comptes. A remplacer par une authentification complète si
    plusieurs contributeurs doivent gérer le site.
    """
    if not x_admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token admin invalide")
