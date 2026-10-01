# B-01 — Perfiles y estado de demostración

## Revisión previa

Se reutilizaron los ocho perfiles de RM-02, los historiales relativos a la referencia de la sesión, `sessionStorage` por perfil, la clasificación existente y los reinicios. Faltaba una interfaz consumible por A: el acuerdo HU-00 solo estaba en documentación y las pantallas leían reglas/estado directamente.

## Criterios cumplidos

| Criterio | Resultado |
| --- | --- |
| Ocho perfiles | Activo de 4 días, interrupción de 10, Camila de 20, Marco de 45, Carlos de 75, Elena con pausa declarada de 28, Diego sin entregas y Valeria bloqueada. |
| Estado separado | Se consulta `profileDataById[id]` del almacenamiento existente. Cada respuesta se copia; cambiar un resultado no modifica la sesión ni otro perfil. |
| Historial, vehículo, preferencias y reloj | `ProfileSnapshot` expone `profile`, `deliveries`, `preferences`, `clock`, `progress` y las entidades ya existentes de la demo. |
| Lima y referencia consistente | `referenceAt` fija por sesión, `observedAt` por perfil y `timeZone: America/Lima`. Simular una entrega avanza solo el perfil correspondiente. |
| Contrato con A | Tipos únicos en `src/contracts/mentor.ts`, `MentorProfileService` compatible con las consultas de `MentorService`, respuestas `ServiceResult`, gateway `src/services/mentor.ts`. |

El caso bloqueado conserva sus 42 días y su historial aunque no sea elegible. Elena tiene cuenta habilitada y cumple el umbral temporal, pero su pausa declarada suspende contactos en el estado expuesto. Andrés de diez días se identifica como prevención, sin crear una invitación ni campaña preventiva.

## Uso para A

```ts
import { mentorService } from './services/mentor'
import type { ProfileSnapshot } from './contracts/mentor'

const response = await mentorService.getProfile('inactive-recent')
if (response.ok) {
  const snapshot: ProfileSnapshot = response.data
  // A conserva su navegación y presenta estos datos.
  console.log(snapshot.profile.name, snapshot.progress.configuration, snapshot.clock)
} else {
  console.log(response.error.message)
}
```

`listProfiles()` devuelve los ocho perfiles con etiquetas basadas en el historial actual. `getProfile()` lee de nuevo cada vez y no llama al reinicio. Un perfil desconocido devuelve `NOT_FOUND`; una falla del adaptador devuelve `UNEXPECTED` sin exponer detalles internos.

La fábrica `createMentorProfileService({ profiles, referenceDate, readState })` permite inyectar el estado vivo del contenedor de A o un adaptador futuro. Su instancia local lee el almacenamiento ya usado por las pantallas. Si el navegador bloquea el almacenamiento, A debe usar esta fábrica con su estado en memoria para compartir el avance; el lector predeterminado solo podrá recuperar los casos iniciales.

## Compatibilidad y límites

- Misma clave de sesión v3 y mismos identificadores. No se lee almacenamiento retirado ni se borra información ajena.
- Se agregaron canales, permiso de recordatorios, fecha de consentimiento simulado y revisión por perfil. Los casos nuevos contienen preferencias explícitas de demostración. Un estado antiguo sin fecha de consentimiento no recibe una fecha inventada; el servicio no lo considera autorizado para contacto externo.
- Guardar incrementa la revisión del perfil cuyo contenido cambió, sin mutar el estado de React. Guardar un contenido idéntico mantiene la revisión. El chequeo de conflictos de escritura pertenece a las acciones futuras.
- Fechas no registradas anteriormente se exponen como `null`: creación de caso/opción, solicitud de recordatorio y presentación/respuesta de invitación. El origen antiguo del inicio de intervención también queda `null` cuando no se conoce.
- Las metas de texto existentes se conservan en `legacyGoalNotes`. `goals`, `contributions` y `goalProgress` permanecen vacíos hasta B-05. No se inventan montos ni ahorros.
- La configuración y las opciones guardadas existentes se adaptan al contrato. La proyección del estado reutiliza el cálculo actual; consultarla aquí no registra una nueva consulta de programa. Los identificadores con prefijo `state-`/`saved-projection-` corresponden al adaptador legado; las acciones futuras producirán registros de proyección propios.
- `mentorService` implementa únicamente `MentorProfileService`. No declara completas las demás historias ni ofrece métodos de escritura ficticios.
- La pausa que se expone es la declarada en el perfil inicial; activar, editar y terminar pausas se implementará en B-07. El acompañamiento devuelve un texto general; B-09 ampliará la personalización.
- Los componentes y `App.tsx` siguen a cargo de A. El recorrido actual conserva su adaptador anterior; A conectará estas consultas mediante el gateway y luego las acciones por entrega.

## Cómo comprobarlo

```bash
npm run demo:b01
npm run demo:b01 -- --profile=inactive-recent
npm test
npm run build
# Con Vite local en ejecución:
npm run test:browser
```

El comando `demo:b01` usa memoria aislada con referencia `2026-10-01T15:00:00Z` (10:00 en Lima), sin modificar el navegador del presentador. El [ejemplo completo de Camila](integracion/ejemplo-perfil-camila.json) se genera desde ese mismo servicio.

Se verifican fechas relativas hasta 2030, cambio de día en Lima, aislamiento de respuestas, lectura sin escrituras, revisiones por perfil, migración sin consentimiento fabricado, errores, configuración/comparación, etiquetas e historial tras una entrega simulada. Los recorridos de navegador existentes verifican que la ampliación del estado conserva recarga/reinicio y ambos canales.

Resultado: 67 pruebas de reglas/almacenamiento, 14 escenarios de navegador contra Vite local y compilación correctos. El ejemplo JSON también se compara con la respuesta real en las pruebas. Esta entrega de la rama del motor no se desplegó ni se verificó en Vercel.
