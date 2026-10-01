# A-09 · Identificar la necesidad · Revisión del motor

Se conserva el trabajo anterior en `feat/motor-operaciones`. No se modifican pantallas, navegación ni contrato compartido.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Preguntar después de la proyección | El cálculo guarda `currentProjection` y el paso `projection`; `updateProgress` puede registrar la respuesta y pasar a `decision`. No exige responder para continuar. | Mostrar la pregunta después del resultado; el motor no impone el orden de las pantallas. |
| Omitir o cambiar | `need` admite respuestas, `skipped` para omisión explícita y `null` para retirar la selección. Las escrituras sustituyen la respuesta y persisten por perfil; no enviar `need` conserva su valor. | Controles para omitir y editar; reemplazar el snapshot tras guardar. |
| No me sale a cuenta | `savings` devuelve `compare` e `incentives`. | Acceso a comparación e incentivos. |
| Tengo poco tiempo | `time` devuelve `shorten` y `save`. | Ajustar duración o confirmar guardado. |
| Tengo un problema pendiente | `payment-order` devuelve `help`. | Ir a ayuda. |
| Ahora no puedo | `personal-vehicle` devuelve `pause` y conserva la alternativa `save` existente. No activa pausa ni recordatorio. | Ofrecer pausa y recoger la decisión voluntaria con `activatePause`. |
| Otro o prefiero omitir | `other` y `skipped` ahora devuelven `continue` con orientación explícita sin obligación. `null` conserva la presentación general y también permite continuar. | Continuación voluntaria y detalle opcional. |

## Revisión y cambios

El registro, edición, omisión, validación y persistencia ya estaban implementados en `updateProgress`. La orientación se deriva en `adviceFor`; se añade el tratamiento explícito de `other` y `skipped`, que antes compartían el mensaje general de cálculo. Se conservan las acciones de las otras respuestas y la prioridad de problemas de acceso, elegibilidad y pausa. Responder no recalcula, guarda opciones, inscribe incentivos, crea solicitudes de ayuda, activa pausas, conecta ni modifica aportes.

Ejemplo de integración: tras calcular, usar `updateProgress(ctx, { need: 'time', step: 'decision' })` y presentar `snapshot.mentor.actions`. Para omitir: `{ need: 'skipped', otherNeedDetail: '' }`; para retirar la selección: `{ need: null, otherNeedDetail: '' }`. Usar un requestId nuevo para otra decisión y conservar el mismo para reintentarla. Un reintento histórico devuelve su respuesta original sin sobrescribir una decisión posterior.

`otherNeedDetail` conserva el tipo `string` y la cadena vacía del contrato existente; no se cambia unilateralmente a `null`. Admite 280 caracteres y se recorta el espacio exterior. Una actualización parcial no elimina el detalle anterior: la interfaz envía `otherNeedDetail: ''` si desea borrarlo al cambiar u omitir. Este campo no es obligatorio para responder `other`.

El módulo antiguo `returnHelp.ts`, usado por las pantallas actuales, ofrece un recordatorio para `personal-vehicle`; no se modifica porque afectaría la experiencia del compañero. Al integrar el nuevo servicio, la interfaz debe usar `mentor.actions` del snapshot, donde esa respuesta ya ofrece pausa. La historia queda soportada por el motor nuevo, pendiente de conectar esas acciones visuales.

## Acuerdo de integración

**Ningún criterio requiere ampliar el contrato.** Se reutilizan `ReturnNeed`, `updateProgress` y `MentorAdvice`. El texto «Ahora no puedo» corresponde al valor existente `personal-vehicle`; no se renombra ese identificador. Preguntar tras la proyección es una responsabilidad de presentación, no una nueva restricción sobre las escrituras del motor.

## Pruebas

`tests/mentorNeeds.test.mjs` comprueba todas las rutas, registro después de calcular, cambios, omisión explícita, retirada con null, detalle opcional, validación y rollback, persistencia, aislamiento, revisiones, reintentos, prioridad de acceso/pausa y ausencia de acciones automáticas. Se ejecuta mediante `npm test`, junto con las pruebas anteriores, y se verifica TypeScript.
