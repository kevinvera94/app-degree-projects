# BRIEF.md
> Fuente de verdad del proyecto. Agnóstico a la herramienta.
> Todos los agentes y archivos de configuración deben referenciar este documento.
> Última actualización: 2026-03-27

---

## 1. Nombre del proyecto
**app-degree-projects**

---

## 2. Descripción
Sistema web para la gestión integral de trabajos de grado de la Facultad de Ingeniería de la Universidad Santiago de Cali (USC). Cubre el ciclo de vida completo: desde la inscripción de la idea por parte del estudiante hasta la generación del acta de aprobación que habilita la solicitud de grado en sistemas externos.

---

## 3. Problema que resuelve
El proceso de trabajos de grado se gestiona actualmente de forma manual o fragmentada (formularios de Google, correos, documentos físicos), lo que dificulta el seguimiento del estado de cada trabajo, la comunicación entre actores y la trazabilidad del proceso. El sistema centraliza y digitaliza este flujo, eliminando ambigüedad en estados y reduciendo tiempos de respuesta.

---

## 4. Contexto institucional
- **Universidad:** Universidad Santiago de Cali (USC)
- **Facultad:** Ingeniería (piloto inicial)
- **Alcance futuro:** extensible a otras facultades
- **Base normativa:** Resolución No. 004 de 2025 — Reglamento de Trabajos de Grado, Facultad de Ingeniería USC (deroga la Resolución 003 de 2019)
- **Estudiantes activos USC:** ~22.000 (toda la universidad)
- **Sistema externo relacionado:** Sistema de solicitud de intención de grado (no integrado en este alcance)
- **Integración futura posible:** Sistema de biblioteca para publicación de trabajos aprobados

---

## 5. Usuarios del sistema (Actores)

| Actor | Rol en el proceso |
|---|---|
| **Estudiante** | Inscribe la idea, diligencia anteproyecto, adjunta informe final (Plantilla A), recibe notificaciones, sube correcciones, diligencia autorización de biblioteca |
| **Comité de Trabajos de Grado (CTG)** | Conformado por el decano, directores de programas, coordinador CEII, coordinador de Extensión. Aprueba/rechaza ideas y anteproyectos, asigna director y jurados, establece fechas, emite actas |
| **Director de trabajo de grado** | Docente (máx. 2 por trabajo) que acompaña al estudiante, da Vo.Bo. y verifica reporte de similitud ≤20% antes de radicar |
| **Jurado 1 / Jurado 2** | Docentes evaluadores (anónimos para el estudiante). Mismos jurados para anteproyecto y producto final cuando sea posible |
| **Jurado 3 (eventual)** | Designado por el CTG solo si uno de los dos jurados reprueba. Solo puede aprobar o reprobar, no devolver para correcciones |
| **Secretaria de facultad** | Apoyo administrativo del CTG. Gestiona ventanas de fechas, coordina comunicaciones |
| **Administrador del sistema** | Configura parámetros, gestiona usuarios, supervisa el sistema |

---

## 6. Flujo completo del proceso (Resolución 004/2025)

### ETAPA 1 — Inscripción de idea
1. El estudiante verifica cumplir los requisitos previos:
   - Pregrado: tener aprobado el 70% de créditos del plan de formación
   - Posgrado: tener aprobado el 50% del plan de estudios
   - Estar matriculado académicamente (o matricular financieramente la opción de grado si ya terminó el plan)
2. Diligencia el formulario de inscripción con:
   - Nombre del trabajo de grado (máx. 100 caracteres)
   - Modalidad seleccionada
   - Número de integrantes (según límites por modalidad — ver sección 8)
   - Datos del estudiante responsable: nombre, cédula, email institucional, celular, dirección
   - Semestre actual y programa académico
   - Línea de profundización y grupo de investigación (GIEIAM o COMBA I+D)
   - Director sugerido (opcional)
3. Sistema registra la idea → estado **"Pendiente de evaluación de idea"**

### ETAPA 2 — Evaluación de la idea por el CTG
4. El CTG revisa la idea y valida unicidad (que no exista trabajo similar en curso o aprobado)
5. Decisión:
   - **Aprobada:** asigna director(es) → notifica al estudiante → estado **"Idea aprobada"**
   - **Rechazada:** registra motivo → estado **"Idea rechazada"**

### ETAPA 3 — Radicación del anteproyecto
6. El estudiante elabora el anteproyecto según el formato de su modalidad
7. El director verifica el reporte de similitud (≤20%) y emite carta de aval
8. El estudiante radica adjuntando **tres documentos obligatorios**:
   - (a) Documento de anteproyecto en la plantilla correspondiente
   - (b) Carta de aval del director de trabajo de grado
   - (c) Reporte de similitud (máx. 20%)
9. Para modalidad **Investigación**: también se requiere aval del comité de ética (enfocado en metodología y recolección de información)
10. Estado → **"Anteproyecto pendiente de evaluación"**

### ETAPA 4 — Evaluación del anteproyecto por el CTG y jurados
11. El CTG asigna dos jurados para revisar el anteproyecto
12. Los jurados tienen **15 días hábiles** para emitir calificación numérica:
    - **≥ 4.0 → Aprobado**
    - **3.0 a 3.9 → Devuelto para correcciones**
    - **< 3.0 → Reprobado**
13. Si un jurado reprueba y el otro aprueba → el CTG designa un **Jurado 3**. Este solo puede aprobar o reprobar (no devolver para correcciones)
14. Si reprobación unánime → el estudiante debe presentar nueva propuesta desde cero (estado **"Anteproyecto reprobado"**)
15. Si aprobado → estado **"Anteproyecto aprobado"**. A partir de este punto **no se pueden agregar integrantes nuevos**

### ETAPA 4b — Correcciones al anteproyecto (si aplica)
16. El estudiante recibe observaciones y tiene **10 días hábiles** para entregar el documento corregido con Vo.Bo. del director
17. Si no cumple el plazo → debe radicar en la siguiente fecha del calendario
18. Si tampoco cumple → debe reiniciar el proceso completo
19. En segunda revisión los jurados tienen **10 días hábiles** y solo pueden aprobar o reprobar

### ETAPA 5 — Desarrollo del trabajo de grado
20. El estudiante desarrolla el trabajo bajo orientación del director
21. El plazo máximo es el **periodo académico** en que se radicó la inscripción. Si no se avanza, se debe reinscribir en el siguiente periodo
22. El sistema registra el estado pero no interviene activamente en esta etapa

### ETAPA 6 — Radicación del producto final
23. En las **ventanas de fechas habilitadas** por el CTG, el estudiante radica el producto final adjuntando **tres documentos obligatorios**:
    - (a) Producto final en la Plantilla A correspondiente a su modalidad
    - (b) Carta de aval del director de trabajo de grado
    - (c) Reporte de similitud (máx. 20%)
24. **Fuera de las ventanas de fechas, el sistema NO permite adjuntar documentos**
25. Estado → **"Producto final entregado"**

### ETAPA 7 — Evaluación del producto final por jurados
26. El CTG asigna los mismos jurados del anteproyecto (cuando sea posible)
27. Los jurados se identifican al estudiante de forma **anónima** como Jurado 1 y Jurado 2
28. Los jurados tienen **15 días hábiles** para emitir calificación numérica (misma escala que anteproyecto)
29. Si un jurado reprueba y el otro aprueba → el CTG designa un **Jurado 3**. Solo puede aprobar o reprobar

### ETAPA 7b — Correcciones al producto final (si aplica)
30. El estudiante recibe observaciones y tiene **10 días hábiles** para entregar el documento corregido con Vo.Bo. del director
31. Si no cumple el plazo → debe radicar en la siguiente fecha del calendario
32. Si tampoco cumple → debe reiniciar el proceso completo
33. En segunda revisión los jurados solo pueden aprobar o reprobar

### ETAPA 8 — Sustentación pública
34. Una vez aprobado el producto final, el CTG establece fecha, hora y lugar de la **sustentación pública**
35. Notifica a director, estudiantes y jurados
36. Calificación de la sustentación: ≥4.0 aprobado, <4.0 reprobado
37. Si reprobación → el estudiante debe presentar nueva propuesta desde cero

### ETAPA 9 — Aprobación final y generación de acta
38. Ambas instancias aprobadas (producto final + sustentación) → estado **"Trabajo aprobado"**
39. El estudiante diligencia el **formato de autorización de publicación** para la biblioteca (indica si autoriza o no)
40. El CTG emite el **Acta de Sustentación / Aprobación de Trabajo de Grado**
41. Con el acta, el estudiante puede iniciar el proceso de solicitud de grado en el sistema externo

### Caso especial — Plagio
- Si se comprueba plagio, copia ilegal o falsificación, el CTG suspende el proceso y remite al comité de ética y disciplina → estado **"Suspendido por plagio"**

---

## 7. Estados del trabajo de grado

```
Pendiente de evaluación de idea
  → Idea aprobada | Idea rechazada
    → Anteproyecto pendiente de evaluación
      → Anteproyecto aprobado | Anteproyecto reprobado
        → (si correcciones) Correcciones anteproyecto solicitadas
          → Anteproyecto corregido entregado
            → En desarrollo
              → Producto final entregado
                → En revisión de jurados (producto final)
                  → (si correcciones) Correcciones producto final solicitadas
                    → Producto final corregido entregado
                      → Aprobado para sustentación
                        → Sustentación programada
                          → Trabajo aprobado | Reprobado en sustentación
                            → Acta generada
Suspendido por plagio (puede ocurrir en cualquier etapa)
```

---

## 8. Modalidades de trabajo de grado (Resolución 004/2025)

| Modalidad | Máx. integrantes | Nivel | Formato anteproyecto | Plantilla producto final |
|---|---|---|---|---|
| Investigación | 3 | Pregrado y posgrado | FORMATO_PROPUESTA_TG-INVESTIGACION | Plantilla_A_Investigación |
| Monografía | 2 | Pregrado | FORMATO_PROPUESTA_TG-MONOGRAFIA | Plantilla_A_Revisión |
| Innovación y Emprendimiento | 3 | Profesional | FORMATO_PROPUESTA_TG-EMPRENDIMIENTO | Plantilla_A_Emprendimiento |
| Cursos de posgrado (9 créditos) | 2 | Pregrado | FORMATO_PROPUESTA_TG-MONOGRAFIA | Artículo de revisión |
| Diplomado | 2 | Pregrado tecnológico | FORMATO_PROPUESTA_TG-MONOGRAFIA | Artículo de revisión |
| Pasantía o Práctica | 1 | Profesional | — | Artículo de actividades |

**Restricciones por nivel:**
- Tecnológicos: Investigación, Monografía, Diplomado
- Profesionales: Investigación, Innovación/Emprendimiento, Diplomado, Cursos de posgrado, Pasantía
- Maestría: solo Investigación
- Doctorado: reglamento específico del nivel

---

## 9. Reglas de negocio clave (Resolución 004/2025)

- El sistema **NO permite** adjuntar documentos fuera de las ventanas de fechas habilitadas por el CTG
- Los jurados son **anónimos** para los estudiantes (Jurado 1 y Jurado 2)
- Para radicar anteproyecto y producto final se requieren **3 adjuntos**: plantilla + carta aval + reporte similitud ≤20%
- **No se pueden agregar integrantes** una vez aprobado el anteproyecto
- El retiro de un integrante requiere solicitud al CTG con justificación y aval del director
- El director debe verificar similitud ≤20% antes de firmar el aval (Art. 31° literal i)
- Los jurados del anteproyecto deben ser los mismos del producto final cuando sea posible
- **Plazo para correcciones:** 10 días hábiles con Vo.Bo. del director
- **Plazo de evaluación jurados:** 15 días hábiles (primera revisión), 10 días hábiles (segunda revisión)
- Si un jurado reprueba y el otro aprueba → se designa **Jurado 3** (solo aprueba o reprueba)
- Reprobación unánime en cualquier etapa → nueva propuesta desde cero
- Plagio comprobado → suspensión y remisión al comité de ética y disciplina
- Un trabajo puede tener hasta **2 directores**; el primero debe ser docente USC en ejercicio
- La aprobación final requiere tanto el producto final aprobado como la **sustentación pública** aprobada

---

## 10. Líneas de investigación (Facultad de Ingeniería USC)
- Logística, operaciones, productividad y gestión de proyectos
- Instrumentación, automatización y sistemas inteligentes
- Gestión y control de la contaminación ambiental
- Arquitectura de Tecnología Informática
- Computación Ubicua, Urbana y Móvil
- Desarrollo de Sistemas Informáticos
- Redes Inalámbricas para la Inclusión Digital y el Desarrollo Económico

**Grupos de investigación:** GIEIAM | COMBA I+D

---

## 11. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + Vite | Arranque rápido, ecosistema maduro, componentes reutilizables |
| Backend | FastAPI (Python) | Tipado con Pydantic, documentación OpenAPI automática, ideal para APIs con roles complejos |
| Base de datos | PostgreSQL | Relaciones complejas entre entidades, robusto, confiable |
| Autenticación | Supabase Auth | Gestión de roles y JWT, reduce semanas de desarrollo |
| Almacenamiento de docs | Supabase Storage | Carga, visualización, modificación y eliminación de archivos |
| Deploy Frontend | Vercel | Deploy en minutos, tier gratuito para MVP |
| Deploy Backend | Render | FastAPI compatible, tier gratuito para MVP |

---

## 12. Estructura de carpetas (tentativa)
```
app-degree-projects/
  specs/
    BRIEF.md
    PRD.md
    ARCHITECTURE.md
    TASKS.md
    DECISIONS.md
  frontend/               ← React + Vite
    src/
      components/
      pages/
      hooks/
      services/
      utils/
  backend/                ← FastAPI
    app/
      routers/
      models/
      schemas/
      services/
      core/
  CLAUDE.md
  README.md
```

---

## 13. Convenciones

| Aspecto | Convención |
|---|---|
| Idioma — documentación y specs | Español |
| Idioma — código, variables, funciones | Inglés |
| Idioma — commits | Español |
| Nomenclatura frontend | camelCase para variables/funciones, PascalCase para componentes |
| Nomenclatura backend | snake_case (Python) |
| Estilo código frontend | ESLint + Prettier |
| Estilo código backend | Black + Flake8 |
| Referencias bibliográficas (documentos académicos) | Formato APA |

---

## 14. Restricciones técnicas
- No integrar con sistemas externos en el alcance del MVP
- Dejar puntos de extensión (adaptadores) para futura integración con sistema de biblioteca
- El sistema debe ser extensible a otras facultades sin reescritura estructural
- No almacenar información sensible de estudiantes más allá de lo estrictamente necesario

---

## 15. Integraciones externas (fuera del MVP — dejar puerta abierta)
- **Sistema de biblioteca USC:** publicación de trabajos aprobados
- **Sistema de solicitud de intención de grado USC:** receptor del acta generada

---

## 16. Reportes y consultas requeridas

### Por docente
- Trabajos asignados como **Director** (activos, finalizados, por estado)
- Trabajos asignados como **Jurado** (activos, finalizados, por estado)
- Carga total del docente (director + jurado combinados)

### Por trabajo de grado
- Estado actual e historial de cambios
- Documentos adjuntos y fechas de entrega
- Calificaciones numéricas por etapa
- Integrantes, director(es) asignados y jurados

### Por modalidad / programa
- Cantidad de trabajos por modalidad
- Cantidad de trabajos por programa académico
- Distribución por estado dentro de cada modalidad/programa

### Por estudiante
- Información personal y de contacto
- Estado actual del trabajo, historial de documentos, calificaciones

### Generales
- Trabajos entregados en una ventana de fechas
- Trabajos pendientes de evaluación (ideas, anteproyectos, productos finales)
- Trabajos con correcciones solicitadas sin respuesta
- Trabajos con plazo de corrección próximo a vencer (alertas)

---

## 17. Comunicación entre usuarios

Módulo de mensajería asíncrona (tipo bandeja de entrada, no chat en tiempo real).

| Origen | Destino | Casos de uso |
|---|---|---|
| Estudiante | Director de trabajo | Consultas, borradores, notificación de avances |
| Estudiante | Jurado (anónimo) | Notificación de correcciones realizadas |
| Director de trabajo | Estudiante | Retroalimentación, orientación, Vo.Bo. |
| Jurado | Estudiante | Solicitud de correcciones (intermediado por el sistema, sin revelar identidad) |
| CTG / Secretaria | Cualquier usuario | Notificaciones de aprobación/rechazo, apertura de ventanas de fechas |

**Consideraciones:**
- El sistema intermedia mensajes de jurado→estudiante mostrando solo "Jurado 1" o "Jurado 2"
- Los mensajes quedan en el historial del trabajo de grado
- Notificación por email al recibir un mensaje nuevo (notificación, no el contenido)
- No es chat en tiempo real — mensajería asíncrona
