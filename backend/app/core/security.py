import urllib.request
import json
from functools import lru_cache

from jose import jwt

from app.core.config import settings


@lru_cache(maxsize=1)
def _get_jwks() -> list[dict]:
    """
    Obtiene las claves públicas del endpoint JWKS de Supabase.
    Se cachea en memoria para evitar llamadas repetidas.
    """
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    with urllib.request.urlopen(url, timeout=10) as response:
        data = json.loads(response.read())
    return data.get("keys", [])


def decode_jwt(token: str) -> dict:
    """
    Decodifica y valida un JWT firmado por Supabase.
    Soporta ES256 (ECDSA P-256) vía JWKS público — algoritmo actual de Supabase.
    Lanza JWTError si el token es inválido o expirado.
    """
    keys = _get_jwks()

    # Intentar con cada clave del JWKS (por si hay rotación de claves)
    last_error: Exception | None = None
    for key in keys:
        try:
            return jwt.decode(
                token,
                key,
                algorithms=["ES256", "RS256"],
                options={"verify_aud": False},
            )
        except Exception as exc:
            last_error = exc

    raise last_error or Exception("No se encontraron claves JWKS para verificar el token")
