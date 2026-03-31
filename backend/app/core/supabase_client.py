from __future__ import annotations

from typing import Optional

from supabase import Client, create_client

from app.core.config import settings

_supabase_admin: Optional[Client] = None


def get_supabase_admin() -> Client:
    """Lazy initialization del cliente Supabase (admin).
    Se instancia solo cuando se llama por primera vez.
    Esto permite que los tests importen app.main sin credenciales de Supabase.
    """
    global _supabase_admin
    if _supabase_admin is None:
        _supabase_admin = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase_admin


# Alias para retrocompatibilidad en otros módulos que importen supabase_admin
# directamente (e.g. act.py). Se reemplaza en los módulos que lo usen
# por la función get_supabase_admin() para evitar la inicialización al importar.
supabase_admin = None  # type: ignore[assignment]
