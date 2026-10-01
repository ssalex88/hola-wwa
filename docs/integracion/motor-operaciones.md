# Motor local y Operaciones · Contrato 1.0

Implementación del alcance de motor/Operaciones (persona B en el acuerdo HU-00), en la rama `feat/motor-operaciones`. La solicitud de trabajo identifica a la persona como A, pero pide este alcance; se mantiene el reparto de archivos del acuerdo. No se modifican `App.tsx`, navegación, pantallas del repartidor ni `mentor.mock.ts`.

## Integración

`src/contracts/mentor.ts` conserva la definición compartida publicada por B-01 en la rama remota; `docs/integracion/mentor-contract.ts` la reexporta. Se mantiene en `src` porque `.vercelignore` excluye `docs` del despliegue. `src/services/mentor.local.ts` implementa todos los métodos de `MentorService` y `DemoAdminService`. El adaptador de lectura B-01 se conserva en `mentor.profile.ts` y se reexporta desde `mentor.local.ts` para sus pruebas y scripts existentes. El punto de entrada `mentor.ts` selecciona el motor completo. Los snapshots incluyen `legacyGoalNotes` y `comparisonConfiguration` del contrato remoto. Todas las respuestas son promesas con el formato acordado. La app actual sigue usando sus servicios anteriores hasta integrar el adaptador.

```ts
import { mentorService } from '../../services/mentor'
import type { RequestContext } from '../../contracts/mentor'

const response = await mentorService.getProfile(profileId)
if (response.ok) {
  const ctx: RequestContext = {
    profileId,
    requestId: crypto.randomUUID(),
    expectedRevision: response.revision,
  }
  const result = await mentorService.saveGoal(ctx, {
    name: 'Reparar mi bicicleta', targetAmount: 150, targetDate: null,
  })
  // Conservar ctx y el contenido para reintentar la MISMA intención.
  // En éxito, reemplazar el snapshot; para otra intención, crear otro requestId.
  // En CONFLICT de revisión, consultar de nuevo antes de editar.
}
```

`mentor.ts` selecciona `localMentorService`. Para desarrollar con el simulado, el compañero puede seleccionar allí su `mockMentorService`, siempre tipado como `MentorService`. No debe cambiar formularios, nombres ni rutas para usar el motor local.

Los errores no modifican estado ni consumen requestId. Un reintento exitoso devuelve la respuesta original, incluso después de recargar; no aplica otra escritura. La misma clave con otra acción/contenido produce `CONFLICT`. La comprobación de revisión ocurre después de buscar el reintento. Las respuestas y consultas son copias: modificar un objeto recibido no modifica el motor.

## Servicios y reglas reutilizadas

Se reutilizan los ocho perfiles, catálogo de tarifas, campañas ficticias, soporte, elegibilidad, validación de configuración y preparación de opciones para revisión. El adaptador agrega metas monetarias y aportes, pausas, permisos efectivos, entidades relacionadas, proyecciones identificadas, reloj compartido y transacciones idempotentes.

- Dinero numérico en PEN, redondeado a dos decimales; aportes manuales positivos. Los avances pueden superar 100%; el saldo pendiente nunca es negativo. No se autocompleta una meta al alcanzar su monto: el estado se cambia explícitamente.
- Una meta activa por perfil; archivar/completar permite crear otra. Editar y borrar aportes vuelve a calcular el avance y comprueba pertenencia.
- Instantes ISO UTC normalizados con milisegundos. Fechas de aporte/plazo son fechas de Lima. Opcionales vacíos son `null`; cadenas vacías no se interpretan como ausencia.
- Camila/Marco/Carlos tienen prioridades 1/2/3. Andrés está en prevención, sin campaña preventiva inventada. Elena puede iniciar voluntariamente mientras sus contactos están suspendidos.
- Inicio elegible y conexión son acciones diferentes. Solo una entrega completada estrictamente posterior al inicio produce regreso; cancelaciones, consultas y guardados no lo producen. El id de entrega impide duplicados aunque cambie requestId. Si llega una entrega histórica anterior al regreso observado, se corrige la primera entrega; el conteo de personas que regresaron sigue siendo uno.
- Revisar una opción usa tabla/referencia actuales, actualiza la franja de `now` y filtra otra vez los incentivos. Una salida programada cuya fecha ya pasó requiere ajuste y devuelve validación. Editar una opción cancela el recordatorio asociado para que no se ejecute sobre otra configuración.
- Pausar conserva preferencias y cancela recordatorios/contactos solicitados pendientes. Terminar o vencer una pausa no los restaura. Rechazar invitaciones no impide consultas voluntarias ni se revierte al terminar la pausa.
- Cada campaña admite un contacto inicial por perfil, compartido entre entradas. Reabrir devuelve el mismo contacto; una vista previa no consume el límite ni registra preferencias, respuestas o eventos de contacto.
- Ayuda no resuelve casos. La inscripción a incentivos registra intención, sin aumentar proyecciones, aportes ni recompensas.

## Persistencia, migración y reloj

Clave nueva: `vuelve-a-tu-ritmo:mentor:session:v1`, en `sessionStorage`. Incluye versión de esquema, ocho perfiles aislados, revisiones, reloj, proyecciones, idempotencia y eventos de sesión. No usa servicios remotos ni `localStorage.clear()`.

`createLocalMentorService({ storage, referenceAt, createId })` permite instancias reproducibles y almacenes de prueba. `storage: null` permite una sesión explícita en memoria. En navegador usa sessionStorage; un fallo de lectura/escritura devuelve `UNEXPECTED`. Una escritura fallida revierte la transacción; el mismo requestId puede reintentarse cuando el almacenamiento se recupere. La implementación vuelve a leer el estado compartido para evitar revisiones obsoletas entre instancias de la misma pestaña.

Sin esquema nuevo se migra v3 de forma no destructiva: preferencias de invitación, entregas, configuración, opciones, soporte, solicitudes, inscripción/beneficios registrados y conexiones válidas. Los textos de metas antiguas quedan en metadatos consultables por Operaciones: nunca se convierten en dinero ahorrado. El inicio elegible se reconstruye con entregas anteriores al instante de inicio; v3 no guardaba origen, por lo que permanece `null`. Los recordatorios pendientes migrados se conservan cancelados, porque v3 no registraba el nuevo consentimiento separado `remindersAllowed`. El rechazo y los contactos iniciales ya presentados se conservan.

El reloj conserva `referenceAt` y permite avanzar `observedAt` de forma explícita; no retrocede. Registrar entregas futuras requiere avanzar primero. Reiniciar perfil afecta sus entidades, reintentos y eventos; conserva el reloj de la sesión y los demás perfiles. Reiniciar demo restaura los ocho perfiles y el reloj observado a la referencia original; las revisiones aumentan para invalidar contextos anteriores. No se alteran las claves de la app antigua, costos de su cohorte ni datos ajenos.

## Controles y Operaciones

`MentorAdminControls` recibe `profileId`, `service`, `admin` y `onSnapshot`. Exporta controles de reloj, entregas, soporte, recordatorios y reinicio. El compañero lo conecta en el contenedor del presentador; las pantallas del repartidor no importan `DemoAdminService`.

`OperationsPanel` conserva la cohorte independiente de 24 personas y agrega `MentorSessionOperations`. Esta sección consulta el motor local y muestra eventos/personas, entradas por origen, opciones, regreso, continuidad, metas, aportes declarados, pausas, rechazos, recordatorios y ayuda. Se actualiza al abrir o con su botón. Hasta integrar las pantallas, sus acciones antiguas no escriben en el nuevo motor. No se combinan ambas fuentes ni se calcula impacto causal con la sesión interactiva.

`getMentorOperations` es una consulta adicional de Operaciones, separada de la interfaz compartida. La cohorte y el costo incremental existentes siguen usando `pilotService` y las pruebas HU-17.

## Límites del contrato y propuestas concretas

No se ha modificado el contrato:

1. `exploreRoute` usa relaciones internas ficticias de demostración para cercanía (origen igual a destino) y corredores con origen/destino. Devuelve zonas del catálogo o `zones: []` si no hay escenario, sin distancias, geolocalización ni asignación de pedidos. A-07 queda soportada con `RouteQuery` y `RouteMatch` actuales; no hace falta publicar `neighborZoneIds` ni ampliar el contrato. Véase [revisión A-07](../revision-a07-motor.md).
2. El contrato permite registrar `requestedFollowupAt`, pero no define una acción administrativa para ejecutarlo. El motor valida y cancela esa solicitud según permisos/pausa, y nunca envía automáticamente. Propuesta: agregar `DemoAdminService.executeInvitationFollowup(ctx, { invitationId })` y una entidad de ejecución idempotente con estado `executed | blocked`. Las demás acciones ya están implementadas.
3. `resetDemo()` devuelve Camila y no recibe requestId. Se respeta esa firma; reinicios y avance del reloj no forman parte del mecanismo de reintentos por requestId. `advanceClock` con el mismo instante no aumenta revisiones.

## Verificación

`tests/mentor.contract-suite.mjs` exporta una suite reutilizable contra otra fábrica de servicios (incluido el simulado del compañero). Solo llama métodos del contrato. `tests/mentor.local.test.mjs` ejecuta esa suite y agrega persistencia, migración, fallos recuperables, eventos y reglas del motor.

```sh
npm test
npm run build
# Con Vite en ejecución:
npm run test:browser
node tests/mentor-browser-check.cjs
```

El recorrido de integración es: consultar Camila → meta/aporte manual → iniciar por app o external → proyección/comparación → guardar → permiso y recordatorio → conexión explícita → avanzar reloj y entrega desde controles → revisar regreso → pausa/contacto bloqueado → reinicio. La suite no requiere modificar pantallas para verificarlo.
