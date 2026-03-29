from jose import JWTError, jwt

from app.core.config import settings


def decode_jwt(token: str) -> dict:
    """
    Decodifica y valida un JWT firmado por Supabase (HS256).
    Lanza JWTError si el token es inválido o expirado.
    """
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
