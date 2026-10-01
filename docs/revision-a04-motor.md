# A-04 · Crear una meta · Revisión del motor

Alcance: servicios, reglas y persistencia en `feat/motor-operaciones`. Se conservan las entregas anteriores. No se modifican pantallas, navegación ni el contrato 1.0.

| Criterio | Soporte del motor | Pendiente de integración de interfaz |
| --- | --- | --- |
| Nombre, monto positivo y fecha opcional | `saveGoal` guarda nombre recortado (1–200 caracteres), monto numérico positivo en PEN redondeado a dos decimales y `targetDate: YYYY-MM-DD | null` en Lima. Rechaza vacío, montos inválidos y fechas imposibles. | Formulario, etiquetas, presentación de soles, errores y traducción de fecha opcional vacía a `null`. |
| Editar, archivar y completar | `saveGoal` con `goalId` edita sin cambiar id, pertenencia, fecha de creación ni estado. `changeGoalStatus` gestiona `active`, `archived`, `completed`; se conserva el historial. | Acciones y confirmaciones visibles. Completar es una decisión explícita; no equivale a registrar un aporte. |
| Una meta activa | Crear otra activa o reactivar una anterior mientras hay otra activa devuelve `CONFLICT`; no archiva metas automáticamente. | Explicar el conflicto y ofrecer archivar/completar la actual antes de crear otra. |
| Continuar sin crearla | Un perfil inicia, calcula, guarda y confirma conexión sin meta. No hay requisito de meta en el programa ni se fabrica una al continuar. | Botón para omitir y su navegación. |
| Crear no activa mensajes/recordatorios | Crear/editar/cambiar estado no modifica consentimientos, canales, contactos, solicitudes posteriores, recordatorios, conexión ni inicio. Tampoco genera aportes, ingresos o pagos. | Mostrar una aclaración como «Crear una meta no activa mensajes ni recordatorios». No se agrega un texto de confirmación al contrato. |

## Revisión y cambio realizado

Los métodos, aislamiento por perfil, persistencia, idempotencia, única meta activa y conteo de metas en Operaciones ya existían. Se reutilizan sin agregar otra API ni campos.

Se corrigió la edición de una meta cuyo plazo venció: ahora puede mantener su fecha original al corregir nombre o monto, también archivada/completada. Puede quitar el plazo con `null` o elegir un nuevo plazo válido. Se mantiene la validación existente para un plazo nuevo: no anterior al día observado en Lima. El hecho de vencer no completa ni archiva automáticamente la meta.

Una meta `completed` puede tener `targetReached: false`: marcarla completada no declara dinero recibido ni genera aportes. El avance proviene exclusivamente de aportes manuales. `mentor.text` continúa personalizándose con la única meta activa según A-02. Operaciones conserva `activeGoals` y no interpreta una meta como contacto, intervención ni ahorro.

## Persistencia y recuperación

Los cambios devuelven el snapshot completo y revisión actualizada. El cliente usa `goalId` para editar y conserva `requestId`/contenido para reintentar la misma intención. Un reintento devuelve la respuesta original, aunque luego haya cambios: para recuperar el estado vigente, se consulta `getProfile`. Los cambios de estado y las fechas opcionales sobreviven la recarga. No se permite editar ni cambiar una meta perteneciente a otro perfil.

## Acuerdo de integración

**Ningún criterio de A-04 requiere ampliar el contrato.** Se usan `saveGoal`, `changeGoalStatus` y las entidades existentes. El formulario opcional, mensajes y navegación corresponden al compañero; no se añaden `skipGoal`, confirmaciones al snapshot ni contactos asociados a la meta.

## Pruebas relacionadas

```sh
node --test tests/mentorGoals.test.mjs tests/mentor.local.test.mjs tests/mentorPresentation.test.mjs tests/mentor-contract-source.test.mjs
node node_modules/typescript/bin/tsc -b
```

Cubren creación y validación, edición y fecha vencida, archivo/completado, una activa y llamadas simultáneas, continuación por ambos orígenes sin meta, ausencia de efectos de contacto, conservación de recordatorios existentes, recarga, reintentos y pertenencia. La interfaz de A-04 queda pendiente hasta que se integren el formulario, las acciones y la aclaración visible.
