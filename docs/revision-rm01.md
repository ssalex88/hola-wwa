# RM-01 — Inicio claro de Soy Rappi

Se revisó el inicio existente y se conservó su base visual. El ajuste pendiente era un acceso a soporte desde el menú; ahora reutiliza los casos y solicitudes simulados existentes.

| Criterio | Implementación y comprobación |
| --- | --- |
| Base visual y diseño móvil | Encabezado, estado, saludo y tarjetas de Soy Rappi; comprobación de anchos de 360 y 390 px y escritorio, sin desbordamiento horizontal. |
| Tarjeta del programa destacada | Primera tarjeta después del saludo, con fondo coral y acción de cálculo. La prueba comprueba su posición antes de la tarjeta de ganancias. |
| Retirar reservas y mover preferencias | No aparece «No tienes reservas»; el formulario de invitaciones se abre desde «Mensajes y recordatorios» en el menú. |
| Ganancias, Incentivos y soporte | Ganancias e Incentivos conservan accesos deshabilitados con «No disponible en esta demo». «Ayuda y soporte» está disponible y rotulado como simulado. No abre tickets reales ni resuelve casos por consultarlos. |
| Identificación discreta | «Demo · Datos simulados» en el inicio. |

## Cómo probarlo

1. Abre `/` con Camila. La propuesta aparece antes de las tarjetas secundarias.
2. Abre el menú: comprueba Ganancias e Incentivos deshabilitados, Mensajes y recordatorios y Ayuda y soporte.
3. En soporte, consulta un caso y registra ayuda simulada. Sigue pendiente; no se registra inicio del programa por abrir soporte. Recargar `/?help=support` conserva la sesión del perfil.
4. Vuelve al inicio: Camila sigue siendo elegible. Cambia al perfil bloqueado y abre «Revisar ayuda de acceso».

La prueba de navegador de inicio cubre estos pasos y los tamaños móviles. La integración con soporte, cuentas, Ganancias e Incentivos reales continúa fuera del alcance de la demo.
