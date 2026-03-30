from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


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
    stage: SubmissionStage
    is_correction: bool = False


class SubmissionResponse(BaseModel):
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
    id: UUID
    submission_id: UUID
    attachment_type: str
    file_name: str
    uploaded_at: datetime
    uploaded_by: UUID


class AttachmentSignedURLResponse(AttachmentResponse):
    signed_url: str


class SubmissionDetailResponse(SubmissionResponse):
    attachments: List[AttachmentResponse] = []
