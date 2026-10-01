# Revisión de HU-05 a HU-09

La revisión corrigió fallos de estado y validación que la compilación por sí sola no detectaba. Se ejecutaron **20 pruebas de reglas/persistencia**, **9 escenarios en Edge a 360 px** y la compilación de producción. Todos pasaron. Las capturas en `artifacts/hu-05-09` también se revisaron visualmente.

## Criterios y comprobación

| HU | Criterios cubiertos | Evidencia |
| --- | --- | --- |
| 05 | Vista WhatsApp simulada, sin envío; tres opciones; identificación ficticia | Escenario de invitación directa comprueba botones, perfil y ausencia de inicio previo. La interfaz no contiene servicios de envío. |
| 05 | Ruta directa al programa, mismo flujo y perfil que la entrada interna | Desde la invitación se llega a `?program=...`; el inicio y menú usan esa misma ruta y el mismo registro local. El recorrido conserva preferencias y comparación entre entrada/salida. |
| 05 | Enlaces inválidos con regreso al inicio | Escenario con token desconocido, programa desconocido y perfiles no elegibles. |
| 06 | Preferencias compartidas, rechazo que detiene invitaciones | Pruebas de política y navegador: rechazo desactiva permisos, retira propuestas iniciales y mantiene el acceso voluntario. |
| 06 | Más adelante con fecha futura o salida sin contacto | Se rechazan fechas vacías/pasadas/inexistentes; sin fecha no se crea ni conserva un contacto. |
| 06 | Sin respuesta o flujo iniciado: no hay otro intento inicial | Registro persistido por campaña, incluido el acceso directo al programa; prueba tras recarga. Un enlace pendiente puede reabrirse como la misma invitación. |
| 06 | Ahora no no provoca mensaje externo | Se conserva el rechazo al recargar; se comprueba que no hay presentación externa ni contacto programado. |
| 06 | Modificar preferencias voluntariamente | Cambio de permiso cancela contactos; editar o borrar una fecha actualiza/cancela el existente. Una fecha preferida sin contacto previo no genera uno. |
| 07 | Zona, duración rápida o editable, ahora u otro día/franja, vehículo precargado y ajustable | Formulario compartido por propuesta y alternativa. Hora de Lima y referencia de demo visibles; para Ahora la franja se determina por esa hora. |
| 07 | Valores editables antes de calcular, validación de obligatorios/fechas | Reglas de calendario real, rango 1–12 horas, selecciones permitidas y mensajes vinculados a cada campo. Escenario de duración cero y fecha pasada antes de proyectar. |
| 07 | Sin pregunta de motivo antes de proyección; sin reserva ni compromiso | El configurador pasa directamente a la estimación y muestra el aviso de libertad. No hay pregunta de motivo ni acción de conexión en estas HU. |
| 08 | Rango reproducible por zona/franja/vehículo | Tabla fija y cálculo puro. Caso: Lima Centro, tarde, bicicleta, 2 h = S/24–40. Repetirlo devuelve los mismos valores. |
| 08 | Gastos editables, ingresos/gastos/resultado separados, sin llamarlo ganancia neta | S/5 de gastos produce S/19–35. Gastos negativos o no finitos invalidan la estimación; un resultado negativo válido no se recorta artificialmente. |
| 08 | Incentivos condicionados separados sin suma automática | Catálogo vacío porque no se entregaron ofertas. El componente presenta condiciones e importe por separado cuando haya datos; el cálculo de ingresos no consume incentivos. No se inventó un incentivo para completar la demo. |
| 08 | Sin garantías, datos simulados y supuestos | Se muestra tarifa horaria de referencia, multiplicación por tiempo y resta de gastos; se explica que la tabla no distingue fechas ni usa demanda/pedidos reales. También están disponibles para cada opción de comparación. |
| 08 | Combinación sin datos y cambio de opciones | Auto devuelve estado sin estimación; el usuario puede volver y elegir bicicleta. No hay un fallback de importes. |
| 09 | Máximo de dos configuraciones con datos requeridos | Dos tarjetas con zona, fecha/momento, horas, vehículo, ingresos, gastos y resultado. No existe una acción para agregar una tercera. |
| 09 | Gastos independientes, cambios que actualizan resultados | Se edita transporte en cada tarjeta y se comprueba que la otra no cambia. Duración, zona y vehículo recalculan su rango. |
| 09 | Selección se convierte en propuesta actual, sin recomendar la de más ingreso | Se selecciona la alternativa y se verifican zona, duración, vehículo, fecha y gastos de la propuesta actual. Ambas tarjetas usan el mismo estilo. |

## Correcciones adicionales para continuidad

- El paso de configuración/proyección/comparación persiste por perfil.
- Cambiar o reiniciar un perfil conserva o reinicia únicamente sus datos.
- Las comparaciones antiguas sin fecha/momento de calendario se migran de forma segura.
- Un acceso directo al programa registra el inicio y cancela el contacto pendiente de la campaña.
- La lógica de invitaciones, validación, tabla de valores, cálculo y adaptador local están separados de los componentes visuales.

## Pendientes de alcance

Continúan pendientes las historias posteriores a HU-09, la API real y una fuente autorizada de incentivos. La demo conserva exclusivamente datos locales y simulados. Esta revisión no implementa preguntas de pausa, ayuda personalizada, conexión ni entregas nuevas.
