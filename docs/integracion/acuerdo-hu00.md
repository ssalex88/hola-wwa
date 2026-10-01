# HU-00 — Propuesta de acuerdo para A y B

Estado: contrato propuesto para acordar antes de dividir el trabajo. No es una afirmación de que todas las nuevas historias estén implementadas. La interfaz TypeScript está en [mentor-contract.ts](mentor-contract.ts).

## 1. Decisiones comunes

- **Nombre del programa:** «Vuelve a tu ritmo». «Rappi Mentor» es el nombre de su acompañamiento dentro del programa, sin afirmar que es un producto oficial ya publicado.
- **A controla:** componentes, textos de pantalla, formularios, navegación y estados de carga. Solo llama al servicio para leer o cambiar datos compartidos.
- **B controla:** reglas, catálogos, persistencia, reloj, controles de demostración y Operaciones. Devuelve elegibilidad, permisos y mensajes; A no los recalcula.
- **Ambos controlan:** el contrato y las respuestas de ejemplo. Ninguno cambia un nombre o estado del contrato sin avisar al otro.
- Todas las llamadas son `Promise<ServiceResult<T>>`, incluso el servicio simulado. Así A puede desarrollar carga/error desde el principio y luego cambiar una única dependencia.
- El origen es `app` o `external`; una vista previa es `demo-preview`, distinta de un contacto simulado. Ambas entradas usan el mismo `profileId`.
- Nunca se envían mensajes reales ni se integra Rappi en este MVP.

## 2. Datos y parámetros que deben compartir

| Concepto | Nombre de contrato | Parámetros principales |
| --- | --- | --- |
| Perfil | `Profile` | `id`, `name`, `vehicle`, `zoneId`, `accountStatus`, `lastCompletedAt` |
| Meta | `Goal` | `id`, `profileId`, `name`, `targetAmount`, `targetDate`, `status` |
| Aporte manual | `Contribution` | `id`, `profileId`, `goalId`, `amount`, `contributedOn`, `source: manual` |
| Zona | `Zone` | `id`, `label`; las rutas usan identificadores de zona, sin geolocalización real |
| Configuración de salida | `ProjectionInput` | `zone`, `hours`, `moment`, `vehicle`, `scheduleMode`, `scheduledDate`, tres gastos |
| Proyección | `Projection` | `status`, configuración, rango, gastos, resultado después de gastos, supuestos, incentivos, versión y fecha |
| Opción guardada | `SavedOption` | `id`, `profileId`, configuración, `projectionId`, referencia, `reminderId`, `isReservation: false` |
| Pausa declarada | `Pause` | `id`, `profileId`, `startedAt`, `endsAt`, `reason`, `status` |
| Invitación | `Invitation` | `id`, `profileId`, `campaignId`, origen, etapa, modo, estado, respuesta y contacto solicitado |
| Recordatorio | `Reminder` | `id`, `profileId`, `savedOptionId`, `scheduledAt`, estado, ejecución, zona horaria |
| Caso de ayuda | `Case` | `id`, `profileId`, `kind`, `description`, `status`, fechas |
| Entrega | `Delivery` | `id`, `profileId`, `status`, `completedAt` |
| Preferencias | `ContactPreferences` | permiso de invitaciones, canales, permiso de recordatorios y fecha de consentimiento |
| Progreso | `ProgramProgress` | configuración, paso, necesidad declarada, inicio elegible, origen, conexión y entrega de regreso |
| Reloj | `DemoClock` | referencia fija, tiempo observado y `America/Lima` |

Los tipos detallan los estados permitidos. Usen identificadores para relaciones, nunca el nombre visible de una persona. Los identificadores de perfiles actuales se conservan.

### Formatos

- Dinero: números en **soles (PEN)**, máximo dos decimales; ejemplo `150`, no `"S/ 150"`. B valida y redondea. Meta y aporte deben ser positivos; gastos pueden ser cero. No hay transferencias reales.
- Instantes: ISO UTC, por ejemplo `2026-10-01T15:00:00.000Z`. A los presenta en **America/Lima**. Una entrada `2026-10-02 08:30` de Lima corresponde a `2026-10-02T13:30:00.000Z`.
- Fechas sin hora: `YYYY-MM-DD` de Lima para plazo de meta y fecha de aporte. Ausencia opcional: `null`, no cadenas vacías.
- Vehículo: `Bicicleta | Moto | Auto`; franjas actuales: `Mañana | Tarde | Noche`; duración: horas, inicialmente entre 1 y 12, botones rápidos 1/2/3.
- Para reutilizar el cálculo actual, `ProjectionInput.zone` conserva la **etiqueta** del catálogo (`Lima Centro`, etc.). Perfil y rutas usan `zoneId`. El adaptador convierte `Zone.id ↔ Zone.label`; A no mantiene un segundo catálogo.
- Identificación: `contractVersion: 1.0`, `simulated: true` donde corresponda; no confundir `demo-preview` con un contacto registrado.

## 3. Acciones comunes

| Acción | Método | Entrada | Respuesta |
| --- | --- | --- | --- |
| Consultar perfil completo | `getProfile` | `profileId` | `ProfileSnapshot` |
| Iniciar intervención | `startProgram` | contexto + `origin` | snapshot con elegibilidad al inicio registrada |
| Calcular proyección | `calculateProjection` | contexto + `ProjectionInput` | `available` o `unavailable`; validación separada |
| Comparar | `compareProjections` | dos configuraciones | dos resultados, sin elegir ganador |
| Guardar/editar opción | `saveOption` | `projectionId`, `optionId` opcional | snapshot actualizado |
| Revisar/eliminar opción | `reviewOption` / `deleteOption` | `optionId` | resultado recalculado / snapshot sin opción ni recordatorio |
| Registrar/editar meta | `saveGoal` | nombre, monto, fecha opcional, `goalId` opcional | snapshot con meta y avance |
| Archivar/completar meta | `changeGoalStatus` | `goalId`, estado | snapshot |
| Registrar/corregir aporte | `saveContribution` | `goalId`, monto, fecha, `contributionId` opcional | snapshot con avance recalculado |
| Eliminar aporte | `deleteContribution` | `contributionId` | snapshot con avance recalculado |
| Activar/editar/terminar pausa | `activatePause` / `updatePause` / `endPause` | fin y motivo opcionales / `pauseId` | snapshot con permisos efectivos |
| Actualizar preferencias | `updatePreferences` | permisos y canales | snapshot; no crea contactos |
| Solicitar ayuda | `requestHelp` | `caseId` | solicitud simulada y caso con su estado original |
| Solicitar/cancelar recordatorio | `scheduleReminder` / `cancelReminder` | opción, instante y consentimiento / identificador | snapshot |
| Registrar entrega | `DemoAdminService.registerDelivery` | identificador, estado e instante | snapshot con regreso si corresponde |

El contrato también incluye catálogo/rutas, invitación y respuesta, conexión explícita, inscripción a incentivo, feedback y controles de reloj/reinicio. A no importa `DemoAdminService` en las pantallas del repartidor.

### Respuestas uniformes

```ts
{ ok: true, data: /* resultado tipado */, revision: 7 }
{ ok: false, error: { code: 'VALIDATION', message: 'Ingresa un monto positivo.', fields: { targetAmount: 'Debe ser mayor que cero.' } } }
```

Una combinación sin datos no es una avería: devuelve `ok: true` y `status: unavailable`, sin rango. `UNEXPECTED` representa un fallo del servicio. A muestra el error y conserva el formulario; no sustituye un fallo con cifras inventadas.

Cada modificación devuelve el snapshot actualizado del perfil; A reemplaza su copia. B es la fuente de verdad. Las consultas no crean intervención, contactos ni retornos. Calcular registra una consulta de proyección, no un ahorro.

`requestId` se genera una vez por acción y se reutiliza en un reintento. B evita duplicar efectos; misma clave con otro contenido produce `CONFLICT`. El identificador de una entrega evita duplicarla aunque cambie `requestId`. La referencia de la sesión proviene de B, no de llamadas independientes a `new Date()` de las pantallas.

## 4. Ejemplos para el servicio simulado de A

### Datos iniciales de Camila

```json
{
  "profile": {
    "id": "inactive-recent", "name": "Camila Torres",
    "vehicle": "Bicicleta", "zoneId": "lima-centro", "accountStatus": "active",
    "lastCompletedAt": "2026-09-11T15:00:00.000Z", "scenario": "Inactivo de 20 días", "simulated": true
  },
  "clock": {
    "referenceAt": "2026-10-01T15:00:00.000Z", "observedAt": "2026-10-01T15:00:00.000Z", "timeZone": "America/Lima"
  },
  "eligibility": {
    "eligible": true, "track": "reactivation", "reason": "eligible",
    "daysInactive": 20, "pauseBand": "15–30 días", "priority": 1
  },
  "goals": [], "contributions": [], "pause": null
}
```

Este es un extracto del snapshot, no la respuesta completa. Fechas ilustrativas: el servicio genera los veinte días respecto a su referencia, no conserva estas fechas fijas.

### Meta y aporte

```ts
await service.saveGoal(ctx, {
  name: 'Reparar mi bicicleta', targetAmount: 150, targetDate: null,
})
await service.saveContribution(nextCtx, {
  goalId: 'goal-camila-1', amount: 20, contributedOn: '2026-10-01',
})
```

Respuesta de avance: `contributedAmount: 20`, `remainingAmount: 130`, `progressPercent: 13.33`, `targetReached: false`. Son montos declarados de ejemplo; no son ingresos ni incentivos prometidos. Nunca sumar una estimación ni una entrega automáticamente.

### Configuración reutilizable

```ts
await service.calculateProjection(ctx, {
  zone: 'Lima Centro', hours: 2, moment: 'Tarde', vehicle: 'Bicicleta',
  scheduleMode: 'now', scheduledDate: null,
  expenseFuel: 0, expenseMaintenance: 2, expenseOther: 0,
})
```

El catálogo actual produce ingresos simulados de 24–40 soles para esa combinación; con esos gastos, 22–38 después de gastos. Respuesta `available` con supuestos y los incentivos separados. Usar vehículo `Auto` permite el caso `unavailable` según los datos actuales. A no pone estos números en el JSX: usa la respuesta.

### Casos que ambos deben compartir

1. Camila 20 días, sin meta, elegible; luego meta y aporte manual.
2. Andrés 10 días: prevención, sin tarjeta de reactivación. No crear una campaña preventiva nueva sin acordarla; conservar prevención separada.
3. Marco 45 días y Carlos 75: elegibles con prioridad 2 y 3.
4. Elena: pausa declarada, consulta voluntaria disponible, contactos suspendidos.
5. Diego sin entregas y Lucía activa: sin propuesta de reactivación.
6. Valeria bloqueada: orientación de acceso, sin conexión ni reactivación.
7. Sin datos de proyección; error de validación; fallo simulado recuperable.
8. Invitación pendiente, respondida, rechazada y vista previa sin registrar contacto.
9. Pausa activa con recordatorios cancelados y reinicio completo.

## 5. Reglas que B garantiza y A presenta

- Una única meta activa. El avance viene de aportes manuales; una aportación que alcanza la meta marca `targetReached`, sin crear compromisos. Al crear otra meta activa, B exige archivar/completar la anterior; no decide silenciosamente por el usuario.
- Elegibilidad, etapa preventiva, prioridad y autorización de contacto se calculan por separado. Estar elegible no autoriza un mensaje.
- Pausa activa suspende contactos y cancela recordatorios pendientes; conserva los permisos previos para mostrarlos. Terminar/vencer la pausa no revierte un rechazo, recupera recordatorios ni envía nada automáticamente. Crear nuevos recordatorios durante pausa devuelve `CONTACT_BLOCKED`.
- Un «Más adelante» sin instante no programa contacto. Todo contacto posterior solicitado vuelve a comprobar permisos y pausa.
- Una invitación externa no solicitada como máximo por perfil/campaña, compartida entre etapas preventiva y reactivación. La vista previa no consume ese límite ni modifica preferencias.
- Regreso: primera entrega completada posterior al inicio de una intervención iniciada siendo elegible. El perfil debe tener cuenta habilitada; un retorno solo se registra una vez. Después, otras entregas sirven para continuidad.
- Corrección de aportes exige pertenencia a perfil/meta; importes positivos; fecha no futura. B recalcula avance. A no registra automáticamente un aporte al mostrar retorno.
- Al revisar una opción, B recalcula con la referencia/tabla vigente y vuelve a filtrar incentivos. Una opción nunca es reserva.
- Recordatorios explícitos, en Lima, ligados a una opción; ejecución simulada idempotente desde controles, comprobando permisos y pausa.

## 6. Qué reutilizar y qué falta

| Existe en el proyecto | Reutilización / adaptación |
| --- | --- |
| `src/data/demoProfiles.ts` | Ocho perfiles y fechas relativas ya implementados. |
| `src/services/demoStorage.ts` y `demoSession.ts` | Estado por perfil, reinicio individual/completo y demo repetible. Adaptar esquema para entidades nuevas y versionar migración. |
| `src/domain/projection*.ts` y `proposals.ts` | Configuración, cálculo, comparación y opciones; envolver en el servicio común. |
| `src/domain/invitations.ts` | Preferencias y rechazo compartidos; ampliar consentimiento/canales, pausa y prevención. |
| `src/domain/reminders.ts`, `support.ts`, `returnTracking.ts` | Reutilizar validación, ayuda y entregas; ampliar pausa/permisos, elegibilidad al inicio y entidades del contrato. |
| `src/components` y `App.tsx` | Reutilizar recorrido y base de Soy Rappi; reemplazar llamadas directas a reglas con el servicio. |
| Metas actuales `goals: string[]` | **No satisfacen A-04/A-05**: migrar a metas monetarias y aportes. No tratar texto antiguo como dinero ahorrado. |
| `OperationsPanel.tsx` | B conserva cohorte ficticia separada; agrega eventos de sesión y nuevas métricas cuando corresponda. |

Todavía faltan el adaptador único, el servicio simulado intercambiable, metas monetarias/aportes, pausa editable con cancelación de recordatorios, rutas cercanas y otras ampliaciones de las nuevas HU. El contrato no ejecuta esas reglas por sí solo.

## 7. Reparto de archivos e integración

Propuesta de estructura acordada (crear al comenzar HU-00):

```text
src/contracts/              ambos, cambios coordinados
src/services/mentor.mock.ts A, respuestas de ejemplo y estado mínimo
src/services/mentor.local.ts B, adaptador de reglas y persistencia
src/services/mentor.ts      ambos, punto único de selección del servicio
src/components/            A, salvo controles y Operaciones asignados a B
src/domain/ y src/data/     B
```

Usar ramas `feat/experiencia-repartidor` y `feat/motor-operaciones` cuando el proyecto esté en un repositorio compartido. **App.tsx lo integra A**; B no lo modifica en paralelo. Los controles/panel de B se exportan como componentes con sus dependencias de servicio; A los conecta en el contenedor. Catálogo y contrato se acuerdan en un primer commit común.

```ts
// Único cambio de implementación al integrar; ambas cumplen MentorService.
export const mentorService: MentorService = mockMentorService
// Después: export const mentorService: MentorService = localMentorService
```

El simulado debe conservar las escrituras básicas por perfil, no devolver siempre la misma respuesta. Ambos ejecutan las mismas pruebas de contrato contra su implementación: guardar/editar, aislamiento, errores, rechazo, pausa y reinicio. B además verifica todas las reglas. A verifica navegación, accesibilidad y estados visuales.

Prueba conjunta final: Camila → meta opcional → zona/proyección → necesidad → guardar o conexión confirmada → entrega desde controles → aporte manual opcional → pausa → contacto bloqueado y recordatorio cancelado → reinicio. El cambio de servicio no debe exigir rehacer componentes ni rutas.
