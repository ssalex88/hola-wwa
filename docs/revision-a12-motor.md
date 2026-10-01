# A-12 · Ayuda y seguimiento del regreso · Revisión del motor

Se conserva el trabajo previo en `feat/motor-operaciones`. No se modifican pantallas, navegación ni contrato compartido.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Casos simulados y estado | `getProfile.cases`: identificador, descripción, tipo, `simulated: true` y `pending/in-review/resolved`. Solo el control administrativo cambia el estado. | Lista y etiquetas Pendiente/En revisión/Resuelto. |
| Solicitud de ayuda | `requestHelp` registra `HelpRequest` separada, por perfil y caso, sin duplicar en reintentos ni solicitudes repetidas. | Acción y confirmación de solicitud registrada. |
| Solicitud no equivale a solución | Pedir ayuda conserva el estado del caso; un caso ya resuelto rechaza una nueva solicitud. | Aclarar que se registró la solicitud y no que el problema fue resuelto. |
| Pregunta opcional tras regreso | Requiere inicio elegible y entrega completada estrictamente posterior al inicio, no futura respecto al reloj. `returnedAt` y `returnDeliveryId` identifican el regreso. `returnFeedback` empieza null y acepta good/mixed/problem/skipped. | Mostrar la pregunta solo tras regreso, permitir omitir y cambiar respuesta. |
| Otra salida o aporte manual | Cálculo/configuración y `saveContribution` siguen disponibles como acciones independientes; no requieren responder seguimiento. | Accesos voluntarios al simulador y alcancía. |
| Sin rachas ni nuevos recordatorios | Entregas y respuestas no activan permisos, programan recordatorios, registran dinero ni exigen más entregas para continuar. | Evitar exigencias de racha o recordatorios activados en la presentación. |
| Recorrido móvil completo | Servicios y datos simulados soportan el recorrido; controles administrativos existentes permiten demostrar entregas y estados. | Entrega del compañero: pantallas, navegación y conexión del servicio al recorrido móvil. |

## Revisión y cambios

Se reutilizan casos, solicitudes, registro administrativo de entregas, seguimiento, persistencia y operaciones existentes. Se refuerza `recordReturnFeedback` con `getReturnResult`: verifica la entrega calificante real, elegibilidad al inicio, reloj y coincidencia de los identificadores de regreso; no basta un timestamp almacenado. Se valida también la entrada de solicitud de ayuda y valoración.

Las consultas, conexiones y entregas canceladas no califican como regreso. Una entrega en el instante del inicio tampoco. Entregas repetidas se deduplican por id; si se registra después una entrega histórica calificante anterior, el motor conserva la primera entrega real posterior al inicio. No exige rachas. El indicador descriptivo de continuidad de Operaciones sigue independiente y no limita funciones del repartidor.

La pregunta no requiere respuesta: puede conservar `returnFeedback: null` o registrar `skipped`. La respuesta `problem` no crea otra solicitud de ayuda ni altera casos automáticamente. Un aporte exige monto, meta propia, fecha válida y una acción explícita distinta del registro de entrega y valoración. Los reintentos conservan la respuesta original y las entidades se aíslan por perfil.

## Acuerdo de integración

**Ningún criterio requiere ampliar el contrato.** Se utilizan `ProfileSnapshot`, `requestHelp`, `recordReturnFeedback`, `updateProgress`, `calculateProjection` y `saveContribution`. Las acciones visuales para otra salida y aporte no necesitan nuevas propiedades en `MentorAdvice`. La entrega móvil completa corresponde a la interfaz del compañero y queda pendiente de integración; no se implementa en archivos de pantallas.

## Pruebas

`tests/mentorFollowup.test.mjs` comprueba estados y solicitudes de ayuda, deduplicación, propiedad por perfil, condiciones temporales de regreso, omisión y edición de valoración, preparación de otra salida sin responder, aporte exclusivamente manual, ausencia de contactos automáticos y recarga. Se ejecutan las pruebas anteriores con `npm test` y la comprobación de TypeScript.
