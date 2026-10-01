# A-10 · Decidir y guardar · Revisión del motor

Se conserva el trabajo anterior en `feat/motor-operaciones`. No se modifican pantallas, navegación ni contrato compartido.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Ir a conexión, guardar y salir | `confirmConnection`, `saveOption` y consulta de perfil disponibles. Salir de una pantalla no requiere escritura. | Botones y navegación; salir no implica desconectar, pausar ni borrar. |
| Confirmación voluntaria | `confirmConnection` exige `explicitConsent === true`; una cuenta bloqueada no conecta. Guardar, calcular y revisar nunca conectan. | Solicitud de confirmación antes de simular la conexión. |
| Revisar, editar y eliminar | `getProfile.savedOptions` lista opciones; `reviewOption` recalcula; `saveOption` con `optionId` reemplaza la configuración a partir de una proyección válida; `deleteOption` elimina también recordatorios asociados. | Lista, edición, confirmaciones y acciones visuales. |
| Opciones, no reservas | Todas las opciones conservan `isReservation: false`. No reservan turno, pedidos ni horario. | Etiquetas y aclaración visible. |
| Actualizar al consultar | Revisión usa reloj, tabla e incentivos actuales; para `now`, actualiza la franja de Lima. Devuelve la nueva proyección y metadatos. | Mostrar la respuesta nueva; gestionar validación o falta de datos sin mostrar una estimación antigua como vigente. |
| Recordatorio opcional y apagado por defecto | Los ocho perfiles tienen `remindersAllowed: false`; guardar deja `reminderId: null`. Habilitar permiso no programa nada. Programar exige consentimiento explícito, opción propia y fecha futura; deshabilitar cancela pendientes. | Control desactivado al inicio y elección voluntaria de fecha/hora. |

## Revisión y cambios

Se reutiliza el ciclo de opciones y recordatorios existente, persistencia aislada, revisiones y requestId. Se corrige `reviewOption`: si actualizar la franja cambia la configuración, cancela el recordatorio pendiente ligado a la configuración anterior y desvincula su id. Una revisión sin cambios conserva un recordatorio solicitado voluntariamente. No se crea ni reactiva otro. También se actualiza `updatedAt` al revisar una configuración válida sin tarifas.

Editar se realiza calculando la configuración nueva y llamando `saveOption(ctx, { optionId, projectionId })`; conserva id y fecha original de guardado. Cancela el recordatorio previo y requiere nueva decisión para programarlo. Un error deja la opción anterior intacta. La revisión de una fecha programada vencida devuelve `VALIDATION`, conserva la opción y permite corregirla mediante ese mismo ciclo.

Si revisar devuelve `unavailable`, ese resultado determina lo que debe mostrarse. El contrato exige `SavedOption.projectionId`, `referenceAt` y `tableVersion`: permanecen como referencia a la última proyección disponible, no como prueba de vigencia de un rango. No se inventa otra proyección ni se cambia el identificador a null. Consultar una opción mientras ya se está conectado tampoco modifica la conexión.

## Acuerdo de integración

**Ningún criterio requiere ampliar el contrato.** La confirmación de conexión es una decisión explícita, separada de guardar y revisar. `MentorAdvice.actions` no incluye navegación a conexión ni salir: los botones de decisión pueden invocar métodos existentes y navegación local sin añadir nuevas acciones al contrato. Tampoco se requiere un método de salida: cerrar la experiencia no modifica el estado del motor.

## Pruebas

`tests/mentorOptions.test.mjs` comprueba guardado, edición, identidad, aislamiento, reintentos, eliminación, revisión con hora de Lima, cancelación o conservación del recordatorio según cambios, permisos desactivados por defecto y conexión con consentimiento estricto. Las pruebas existentes cubren recarga, fechas vencidas, ausencia de datos, incentivos vencidos y ejecución de recordatorios. Se ejecutan con `npm test` y se verifica TypeScript.
