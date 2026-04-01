from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubmissionStage(str, Enum):
    anteproyecto = "anteproyecto"
    correcciones_anteproyecto = "correcciones_anteproyecto"
    producto_final = "producto_final"
    correcciones_producto_final = "correcciones_producto_final"


class AttachmentType(str, Enum):
    plantilla = "plantilla"
    carta_aval = "carta_aval"
    reporte_similitud = "reporte_similitud"
    aval_etica = "aval_etica"
    certificacion_plan_negocio = "certificacion_plan_negocio"
    carta_impacto = "carta_impacto"
    autorizacion_biblioteca = "autorizacion_biblioteca"
    retiro_integrante = "retiro_integrante"
    otro = "otro"


# Adjuntos obligatorios por todas las modalidades
REQUIRED_ATTACHMENTS_BASE = frozenset(
    {
        AttachmentType.plantilla,
        AttachmentType.carta_aval,
        AttachmentType.reporte_similitud,
    }
)
REQUIRED_ATTACHMENTS_BASE = frozenset({
    AttachmentType.plantilla,
    AttachmentType.carta_aval,
    AttachmentType.reporte_similitud,
})

# Adjunto extra para modalidad Investigación (requires_ethics_approval = true)
REQUIRED_ATTACHMENT_ETHICS = AttachmentType.aval_etica

# Adjuntos obligatorios para entrega de correcciones (documento corregido + Vo.Bo. director)
REQUIRED_ATTACHMENTS_CORRECTION = frozenset({
    AttachmentType.plantilla,
    AttachmentType.carta_aval,
})

# Adjunto extra para modalidad Innovación y Emprendimiento (requires_business_plan_cert = true)
REQUIRED_ATTACHMENT_BUSINESS_PLAN = AttachmentType.certificacion_plan_negocio


class SubmissionCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "stage": "anteproyecto",
        "is_correction": False,
    }})

    stage: SubmissionStage
    is_correction: bool = False


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "d0e1f2a3-0123-ef01-3456-789012345678",
        "project_id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "stage": "anteproyecto",
        "submitted_at": "2026-02-20T16:00:00Z",
        "submitted_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "date_window_id": "d4e5f6a7-4567-89ab-def0-123456789012",
        "is_extemporaneous": False,
        "revision_number": 1,
        "status": "pendiente",
    }})

    id: UUID
    project_id: UUID
    stage: str
    submitted_at: datetime
    submitted_by: UUID
    date_window_id: Optional[UUID]
    is_extemporaneous: bool
    revision_number: int
    status: str


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "e1f2a3b4-1234-f012-4567-890123456789",
        "submission_id": "d0e1f2a3-0123-ef01-3456-789012345678",
        "attachment_type": "plantilla",
        "file_name": "anteproyecto_v1.pdf",
        "uploaded_at": "2026-02-20T16:05:00Z",
        "uploaded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    }})

    id: UUID
    submission_id: UUID
    attachment_type: str
    file_name: str
    uploaded_at: datetime
    uploaded_by: UUID


class AttachmentSignedURLResponse(AttachmentResponse):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "e1f2a3b4-1234-f012-4567-890123456789",
        "submission_id": "d0e1f2a3-0123-ef01-3456-789012345678",
        "attachment_type": "plantilla",
        "file_name": "anteproyecto_v1.pdf",
        "uploaded_at": "2026-02-20T16:05:00Z",
        "uploaded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "signed_url": "https://storage.supabase.co/object/sign/attachments/anteproyecto_v1.pdf?token=eyJ...",
    }})

    signed_url: str


class SubmissionDetailResponse(SubmissionResponse):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "d0e1f2a3-0123-ef01-3456-789012345678",
        "project_id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "stage": "anteproyecto",
        "submitted_at": "2026-02-20T16:00:00Z",
        "submitted_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "date_window_id": "d4e5f6a7-4567-89ab-def0-123456789012",
        "is_extemporaneous": False,
        "revision_number": 1,
        "status": "pendiente",
        "attachments": [],
    }})

    attachments: List[AttachmentResponse] = []
