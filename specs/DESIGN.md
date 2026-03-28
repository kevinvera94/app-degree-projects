# DESIGN.md — Identidad visual y paleta de colores
> Estándares visuales del sistema app-degree-projects.
> Basado en la identidad gráfica de la Universidad Santiago de Cali (material de acreditación institucional).
> Última actualización: 2026-03-28

---

## Paleta de colores

### Colores de marca USC

| Token | HEX | RGB | Uso |
|---|---|---|---|
| `color-usc-navy` | `#0D2B5E` | 13, 43, 94 | Sidebar, header, fondos principales |
| `color-usc-blue` | `#1B6BB5` | 27, 107, 181 | Botones primarios, links, acentos interactivos |
| `color-usc-gold` | `#C9A840` | 201, 168, 64 | Badges, highlights, elementos decorativos |
| `color-usc-gold-light` | `#F0D269` | 240, 210, 105 | Hover states, íconos decorativos |

### Neutros

| Token | HEX | Uso |
|---|---|---|
| `color-text-dark` | `#1A2A4A` | Texto principal del sistema |
| `color-gray-500` | `#64748B` | Texto secundario, placeholders, labels |
| `color-gray-200` | `#E2E8F0` | Bordes, separadores, dividers |
| `color-gray-50` | `#F4F6FA` | Fondos de página, zebra en tablas |
| `color-white` | `#FFFFFF` | Fondos de tarjetas y contenido |

### Semánticos — Estados del sistema

| Token | HEX | Estado del trabajo de grado |
|---|---|---|
| `color-success` | `#16A34A` | Aprobado, acta generada |
| `color-warning` | `#F59E0B` | Correcciones solicitadas, plazo próximo a vencer |
| `color-error` | `#DC2626` | Rechazado, reprobado, suspendido por plagio |
| `color-info` | `#0284C7` | Pendiente de evaluación, en revisión |
| `color-neutral` | `#64748B` | En desarrollo, estados intermedios |

---

## Uso de colores por componente

| Componente | Color |
|---|---|
| Sidebar / navbar | `color-usc-navy` |
| Botón primario | `color-usc-blue` |
| Botón secundario | Borde `color-usc-navy`, texto `color-usc-navy` |
| Badge de acreditación / marca USC | `color-usc-gold` |
| Fondo de página | `color-gray-50` |
| Tarjetas / cards | `color-white` |
| Texto principal | `color-text-dark` |
| Texto de apoyo | `color-gray-500` |
| Bordes de inputs | `color-gray-200` |
| Badge estado Aprobado | `color-success` |
| Badge estado Correcciones | `color-warning` |
| Badge estado Rechazado / Plagio | `color-error` |
| Badge estado Pendiente | `color-info` |
| Badge estado En desarrollo | `color-neutral` |

---

## Notas de implementación

- En React + Tailwind: definir estos tokens en `tailwind.config.js` bajo `theme.extend.colors`
- Nunca usar valores HEX directamente en componentes — siempre referenciar el token
- El contraste de texto blanco sobre `color-usc-navy` y `color-usc-blue` cumple WCAG AA
- Evitar usar `color-usc-gold` como fondo de texto oscuro sin verificar contraste
