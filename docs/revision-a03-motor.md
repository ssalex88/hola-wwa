# A-03 · Invitación externa · Revisión del motor

Alcance: servicios, reglas y persistencia en `feat/motor-operaciones`. Se conservan los cambios anteriores y no se modifican pantallas, navegación ni ninguna copia del contrato 1.0.

## Criterios e integración

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Pantalla tipo WhatsApp, simulada | `origin: external`, `mode: simulated-contact` frente a `demo-preview`, perfil `simulated: true`; ningún mensaje real. | Diseño tipo WhatsApp y etiqueta visible «Simulación». |
| Tres decisiones | `respondInvitation` recibe `options`, `later` o `decline`. | Botones «Ver opciones», «Más adelante» y «No recibir estas invitaciones». La pantalla actual usa «No me interesa»: el compañero debe ajustar esa etiqueta, no el contrato. |
| Mismo programa del inicio | `startProgram` usa el mismo `profileId` con `origin: external`; comparte metas, opciones, configuración y seguimiento. Un inicio posterior por app conserva la intervención y su origen inicial. | Navegar al mismo programa después del éxito del servicio. |
| Confirmaciones claras | El snapshot actualizado devuelve `status`, `respondedAt`, `requestedFollowupAt` y preferencias efectivas. Fallos usan el formato acordado y no cambian datos. | Mostrar confirmación solo tras `ok: true`, con texto y accesibilidad propios de la interfaz. |
| Pendiente, respondida y ejemplo | Se conservan `pending`, `opened`, `later`, `declined` y `expired`. Reabrir conserva la decisión incluso si hay rechazo, pausa, inicio o regreso. Un ejemplo reutiliza `demo-preview`, sin contacto, respuesta ni cambio de preferencias. | Presentar estados; decisiones ya respondidas no se reescriben; las respuestas del ejemplo son demostrativas y no deben llamar `respondInvitation`. |
| Mismo perfil interno/externo | Todos los métodos consultan/escriben el perfil del contexto; aislamiento por id, revisión, persistencia y reintentos existentes. | Resolver la entrada externa al id acordado y usar ese mismo id al abrir el programa. No reiniciar ni duplicar el perfil al cambiar de entrada. |

## Cambios realizados

- `presentInvitation` distingue **reabrir** de **crear contacto**. Devuelve el registro existente de perfil/campaña/origen/modo antes de comprobar permisos para generar otro contacto. No borra decisiones ni agrega contactos/eventos. Para una lectura sin escritura, se usa `getProfile`; una nueva llamada de presentación sigue registrando su requestId/revisión según el mecanismo existente.
- Las reglas de consentimiento, canal, rechazo, pausa y elegibilidad se mantienen para contactos nuevos. Los ejemplos son ficticios de reactivación y están disponibles en los ocho escenarios; eso no autoriza una intervención ni crea una campaña preventiva. `startProgram` conserva sus restricciones.
- `respondInvitation` diferencia un registro vencido de uno ya respondido. Responder otra vez con un nuevo requestId produce `CONFLICT`; reintentar la misma intención devuelve el éxito original. El compañero vuelve a consultar el snapshot para mostrar la decisión vigente.
- La migración v3 conserva «Más adelante», rechazo, pendiente y opciones ya abiertas según evidencia existente. No inventa `presentedAt` ni `respondedAt`; quedan `null` cuando v3 no los registraba. Las fechas sin hora del contacto posterior antiguo no se convierten en instantes arbitrarios ni se reprograman.
- Operaciones ya distingue contactos simulados, rechazo y origen de intervención. Se verifica que reaperturas, vistas previas y reintentos no dupliquen esos conteos; no se agrega otra pantalla ni se mezcla la cohorte ficticia.

## Cómo conectar las decisiones sin ampliar el contrato

1. Leer `getProfile(profileId)` para recuperar el registro por `campaignId`, `origin: external` y modo. `presentInvitation` solo es necesario para la primera presentación; si se reutiliza, conserva el id y estado existentes.
2. «Ver opciones»: responder con `response: options`, `requestedFollowupAt: null`; después iniciar con `startProgram(..., { origin: external })` en el mismo perfil y navegar tras el éxito. Usar dos requestId diferentes (una intención por método) y la revisión devuelta por cada paso. Si el segundo paso falla, conservar el estado `opened`, consultar de nuevo y reintentar el inicio sin volver a responder. La respuesta no conecta ni registra una entrega automáticamente.
3. «Más adelante»: responder con `response: later`, `requestedFollowupAt: null`. Confirmación sugerida de interfaz: «Puedes volver cuando te convenga. No programamos otro contacto». Solo un instante futuro solicitado explícitamente habilita guardar una solicitud de contacto; no se ejecuta automáticamente.
4. «No recibir estas invitaciones»: responder con `response: decline`, `requestedFollowupAt: null`. Se desactiva `allowProgramInvitations` para ambos canales y se cancelan solicitudes posteriores. Confirmación sugerida: «No recibirás estas invitaciones en la simulación. Puedes abrir el programa desde el inicio». El permiso de recordatorios es distinto y se conserva; el acceso voluntario sigue sujeto a cuenta/elegibilidad.
5. Para una invitación ya respondida, mostrar su estado y ofrecer consulta voluntaria del programa cuando corresponda. No llamar de nuevo a una respuesta final para cambiarla. Para un ejemplo, mostrar la etiqueta y conservar las decisiones ficticias en estado local de la interfaz; no simular consentimiento mediante escrituras del perfil.

## Acuerdo de integración

**Ningún criterio descrito exige ampliar el contrato.** El compañero puede implementarlos usando los métodos y estados existentes. Hay dos capacidades adicionales que requerirían acuerdo si se desean:

- Una respuesta **atómica** «Ver opciones + iniciar»: propuesta `openInvitationOptions(ctx, { invitationId }): SnapshotResult`, que valida pertenencia/elegibilidad y registra `opened` e inicio externo en una transacción. No está implementada; por ahora se usan los dos métodos acordados con recuperación del segundo paso.
- Resolver enlaces opacos sin conocer profileId: propuesta `resolveInvitation(token: string): Promise<ServiceResult<{ profileId: ProfileId; invitationId: string }>>`, con tokens asociados a registros existentes y sin efectos de contacto. No está implementada. La demo actual usa el mapeo de ids/enlaces existente, cuya navegación pertenece al compañero.

No se agrega `confirmationMessage` a respuestas ni a `Invitation`: los textos visuales pueden derivarse de estados conocidos. Centralizarlos en el motor requeriría acordar ese campo primero.

## Pruebas relacionadas

```sh
node --test tests/mentorInvitations.test.mjs tests/mentor.local.test.mjs tests/mentorPresentation.test.mjs tests/mentor-contract-source.test.mjs tests/program.test.mjs tests/demoSession.test.mjs
node node_modules/typescript/bin/tsc -b
```

Cubren las tres decisiones, persistencia, perfil interno/externo compartido, reapertura bajo restricciones, ejemplos en todos los escenarios, migración, pertenencia, validación, reintentos y métricas sin duplicados. La prueba del contrato verifica que sus firmas no cambien. No se considera verificada la pantalla de A-03 hasta que el compañero integre sus botones, confirmaciones y navegación.
