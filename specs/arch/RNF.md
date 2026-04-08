# RNF.md — Requerimientos No Funcionales
> Atributos de calidad del sistema. Complementan los requerimientos funcionales definidos en `specs/prd/`.
> Se derivan del contexto institucional (`specs/BRIEF.md`), la arquitectura técnica (`specs/ARCHITECTURE.md`) y las restricciones de infraestructura (`specs/arch/INFRA.md`).
> Última actualización: 2026-04-08

---

## RNF-01 — Rendimiento

| Operación | Tiempo máximo aceptable |
|---|---|
| CRUD típico (consultar estado, registrar calificación, aprobar/rechazar) | ≤ 1 segundo bajo carga normal |
| Listado o búsqueda de trabajos (hasta 500 registros activos) | ≤ 2 segundos |
| Generación de reportes (volumen de un período académico completo) | ≤ 5 segundos |
| Carga y descarga de archivos PDF | Proporcional al tamaño del archivo (límite: 20 MB) |

---

## RNF-02 — Escalabilidad

- El sistema debe soportar hasta **22.000 usuarios registrados**, que corresponde a la totalidad de estudiantes activos de la Universidad Santiago de Cali cuando el sistema se extienda a todas las facultades (ver `specs/BRIEF.md`, sección 4).
- **Piloto inicial (Facultad de Ingeniería):** ~5.000 estudiantes + ~200 docentes + ~10 administradores.
- La arquitectura **stateless** del backend (FastAPI) permite escalar horizontalmente mediante múltiples instancias sin cambios de código.
- El campo `faculty_id` en las entidades clave (`academic_programs`, `modalities`, `date_windows`, `thesis_projects`) permite la extensión a otras facultades sin reescritura estructural (ver `specs/arch/INFRA.md`, sección "Consideraciones para multi-facultad").
- Supabase/PostgreSQL soporta connection pooling para manejar picos de tráfico en períodos de alta demanda (apertura de ventanas de fechas, entrega de productos finales).

---

## RNF-03 — Disponibilidad

- **Disponibilidad objetivo:** ≥ 99% durante el período académico activo (8:00 AM – 10:00 PM, días hábiles).
- **Mantenimiento programado:** únicamente en períodos inter-semestrales, con aviso previo de al menos 48 horas.
- La infraestructura cloud (Vercel + Render + Supabase) es responsable del SLA de la capa de infraestructura; el sistema depende de sus garantías de disponibilidad.

> **Advertencia MVP:** el plan gratuito de Render entra en estado de inactividad tras 15 minutos sin tráfico, generando un cold start de hasta 50 segundos en la primera solicitud. Esto es inaceptable para producción real. Se debe migrar al plan de pago (`Starter` o superior) antes del lanzamiento oficial con usuarios reales.

---

## RNF-04 — Seguridad

- **Autenticación:** JWT firmado con algoritmo HS256 (Supabase Auth). Access token con expiración de **1 hora**; refresh token con expiración de **7 días**.
- **Almacenamiento de tokens en el cliente:** en memoria React (context/state), nunca en `localStorage` ni `sessionStorage`, para mitigar ataques XSS.
- **Autorización:** todo endpoint protegido valida el JWT y el rol del usuario antes de ejecutar cualquier lógica de negocio.
- **Acceso a documentos:** los archivos en Supabase Storage son privados. El cliente accede únicamente mediante **signed URLs con expiración de 1 hora**. El frontend nunca accede directamente al bucket.
- **Anonimato de jurados:** la identidad de los jurados se filtra en la **capa de servicio del backend**, no solo en el frontend. Ningún serializer que sirva al rol `estudiante` debe exponer `docente_id`, `full_name` ni `email` de un jurado.
- **CORS:** configurado para aceptar únicamente el dominio de Vercel en el entorno de producción (`ALLOWED_ORIGINS`).
- **Gestión de contraseñas:** delegada íntegramente a Supabase Auth. El backend propio no almacena, procesa ni transmite contraseñas.
- **Clave de servicio:** `SUPABASE_SERVICE_ROLE_KEY` solo disponible en el backend; nunca expuesta al cliente ni a variables de entorno `VITE_*`.

---

## RNF-05 — Privacidad y protección de datos

- El sistema recopila únicamente los datos estrictamente necesarios para el proceso académico (ver `specs/BRIEF.md`, sección 14).
- La identidad de los jurados es **anónima para los estudiantes** en toda la plataforma: en la API, en la mensajería y en las evaluaciones.
- El acceso a los documentos de un trabajo está restringido a sus participantes directos: estudiantes miembros, director(es), jurados asignados y administradores.
- En el alcance del MVP **no hay integración con sistemas externos**. Cualquier futura integración (biblioteca, sistema de intención de grado) debe revisar el alcance y la clasificación de los datos compartidos antes de implementarse.

---

## RNF-06 — Usabilidad

- El sistema debe ser operable por usuarios con conocimiento básico de herramientas web (formularios, carga de archivos, botones) **sin capacitación técnica especializada**.
- El flujo principal (inscripción de idea → radicación de documentos → consulta de estado) debe ser accesible en **≤ 3 clics desde el dashboard** del usuario.
- Los mensajes de error de validación deben estar en **español**, indicar el campo que falla y explicar el motivo con claridad.
- **Resolución mínima soportada:** 1024px (escritorio y laptop). Responsividad en dispositivos móviles es deseable pero no es prioridad para el MVP.

---

## RNF-07 — Mantenibilidad

- **Parámetros operativos configurables vía variables de entorno**, sin necesidad de modificar ni redesplegar código:
  - Plazos de evaluación de jurados (primera revisión y segunda revisión)
  - Plazo de correcciones del estudiante
  - Días de alerta previos al vencimiento de jurados
  - Archivo de festivos académicos USC (JSON por período)
- **Separación de responsabilidades por capas:**
  - Routers → validación de entrada (Pydantic schemas)
  - Services → lógica de negocio
  - Models → persistencia (SQLAlchemy ORM)
- Los módulos del sistema (MOD-01 a MOD-17) deben ser independientes entre sí; un cambio en un módulo no debe romper la lógica de otro.
- El archivo de festivos USC (`usc_holidays.json`) se actualiza al inicio de cada período académico sin modificar código.

---

## RNF-08 — Portabilidad

- **Frontend:** compatible con las **2 últimas versiones principales** de los navegadores Chrome, Firefox, Microsoft Edge y Safari.
- **Backend:** contenerizado con Docker (`Dockerfile` incluido en el repositorio), lo que garantiza independencia del sistema operativo del servidor de despliegue.
- Sin dependencia de plataforma específica en el backend (Python puro + FastAPI); puede migrarse a cualquier proveedor cloud compatible con contenedores.

---

## RNF-09 — Compatibilidad de datos

- La API REST sigue el contrato definido en `specs/arch/API.md`. Cualquier cambio de ruptura (breaking change) requiere versionado de la API (`/api/v2`) y un período de transición.
- **Formato de documentos aceptado:** exclusivamente PDF (`.pdf`). No se acepta ningún otro formato.
- **Tamaño máximo por archivo:** 20 MB. La validación de tipo y tamaño se realiza en el **backend** antes de subir a Supabase Storage.

---

## RNF-10 — Trazabilidad y auditoría

- Todo cambio de estado de un trabajo de grado queda registrado en `project_status_history` con: usuario que ejecutó la acción, timestamp UTC y estado anterior/nuevo.
- Las calificaciones registradas fuera del plazo hábil quedan marcadas como **extemporáneas** en el sistema. No se bloquean — el sistema las acepta y las señala para el reporte de incumplimiento.
- Los mensajes del módulo de mensajería asíncrona quedan vinculados al trabajo de grado como registro permanente; no se pueden eliminar.
