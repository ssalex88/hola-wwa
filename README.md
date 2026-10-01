# Vuelve a tu ritmo

MVP de React + Vite + TypeScript para el reto 02 de Innovathon Rappi x ULima. Perfiles, entregas, ingresos, incentivos, ayuda y resultados son **simulados**. No envía mensajes, asigna pedidos, realiza pagos ni se integra con Rappi.

## Ejecutar

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

## Demostrar en un minuto

1. Abre el inicio: Camila tiene cuenta habilitada, entregas previas y 20 días de pausa. Pulsa **Calcular cuánto podría generar**.
2. Elige 1, 2 o 3 horas; zona y vehículo ya están precargados. Calcula y revisa el rango; **Ajustar gastos de esta salida** permite evaluar lo que queda después de esos gastos.
3. Responde **Tengo poco tiempo** y pulsa **Reducir a 1 hora**, o usa **Omitir y continuar**. Puedes guardar una opción o abrir la conexión; esta requiere otra confirmación voluntaria.
4. En **Controles de demo**, pulsa **Completar entrega**. Aparece el regreso y puedes preparar otra salida. **Reiniciar demostración** restaura todos los escenarios.

Para presentar la segunda entrada, reinicia y pulsa **Ver invitación externa**. También puedes abrir `/?invite=pilot-demo-inactive-recent` directamente.

[Guía del recorrido y su relación con el reto 02](docs/guia-demo-reto02.md).

## Trabajo en equipo — HU-00

Antes de dividir el desarrollo, revisen el [acuerdo de integración](docs/integracion/acuerdo-hu00.md) y el [contrato TypeScript compartido](src/contracts/mentor.ts). Definen datos, acciones, respuestas, ejemplos y responsabilidades de experiencia y motor. B-01 implementa `listProfiles` y `getProfile` en `src/services/mentor.ts`; las demás acciones se incorporan por entrega.

### Servicio de perfiles — B-01

```ts
import { mentorService } from './services/mentor'

const profiles = await mentorService.listProfiles()
const camila = await mentorService.getProfile('inactive-recent')
if (camila.ok) {
  console.log(camila.data.profile, camila.data.deliveries, camila.data.clock)
}
```

Las consultas leen el mismo estado por perfil de la demo y devuelven copias independientes; no crean contactos ni reinician la sesión. El resultado incluye preferencias, configuración, progreso, pausa declarada y fechas en ISO, con `America/Lima` como zona de presentación. Un identificador desconocido devuelve `NOT_FOUND`.

Para B y para revisar los datos con A, sin abrir las pantallas:

```bash
npm run demo:b01
npm run demo:b01 -- --profile=inactive-recent
```

El comando usa un caso aislado en memoria y una referencia fija. [Ejemplo completo de Camila](docs/integracion/ejemplo-perfil-camila.json) y [criterios y pruebas de B-01](docs/revision-b01.md). Las metas monetarias y aportes siguen pendientes; los objetivos de texto anteriores se exponen como `legacyGoalNotes`, sin convertirlos en dinero.

## Experiencia y presentación

Dentro del celular hay tres pasos: **Tu tiempo y zona → Tu estimación → Tú decides**. La pregunta opcional aparece después de un resultado válido. Ofrece comparación, ajuste de tiempo, ayuda de pago o pedido, salida sin presión y recordatorio solicitado para una opción concreta.

La ayuda opcional presenta tarjetas con iconos y una breve explicación de cada acción. Al elegir una respuesta se muestra su ayuda directamente; **Cambiar respuesta** permite volver a las opciones. **Omitir y continuar** está disponible desde el principio. Al reducir la duración, el rango después de los gastos ingresados se actualiza junto a la acción, y se puede guardar esa opción.

El inicio conserva la base visual de Soy Rappi: encabezado, saludo, tarjeta de ganancias, registro y tarjetas informativas. La propuesta ocupa el primer lugar; las demás secciones tienen accesos claramente deshabilitados. Reservas y preferencias no ocupan tarjetas del inicio.

El menú conserva **Ganancias** e **Incentivos**, señalados como no disponibles, y ofrece **Ayuda y soporte** con los casos simulados existentes. Abrir soporte no inicia la intervención ni resuelve un caso. Una cuenta bloqueada puede revisar la orientación de acceso desde el inicio o el menú.

El menú contiene **Mensajes y recordatorios**. La preferencia de recibir invitaciones es distinta del recordatorio para una opción guardada. Los recordatorios están desactivados por defecto y exigen fecha y hora futuras, en Lima. No hay contactos automáticos ni mensajes reales.

Los incentivos existentes en el catálogo ficticio son un complemento: se filtran por compatibilidad, muestran sus condiciones y no se suman como ingresos asegurados. No se crearon campañas adicionales para esta revisión. Los rangos no garantizan pedidos ni ingresos; tampoco se presenta el resultado después de gastos ingresados como ganancia neta.

**Controles de demo** agrupa perfiles, simulación de entregas, estados de soporte, ejecución de recordatorios y reinicio. Se puede colapsar; en móvil está debajo del celular. Activos, personas sin entregas previas y cuentas bloqueadas no reciben una propuesta de reactivación. La cuenta bloqueada muestra orientación de acceso.

### Perfiles — RM-02

| Escenario | Persona ficticia | Última entrega | Vehículo · Zona |
| --- | --- | --- | --- |
| Activo | Lucía Rojas | Hace 4 días | Bicicleta · Surco |
| Interrupción de 10 días | Andrés Vega | Hace 10 días | Moto · San Miguel |
| Inactivo de 20 días | Camila Torres | Hace 20 días | Bicicleta · Lima Centro |
| Inactivo de 45 días | Marco Salas | Hace 45 días | Moto · Miraflores |
| Más de 60 días | Carlos Cruz | Hace 75 días | Moto · Lima Centro |
| Pausa declarada | Elena Medina | Hace 28 días | Bicicleta · Jesús María |
| Sin entregas previas | Diego Paredes | Sin historial | Moto · San Miguel |
| Bloqueado | Valeria Núñez | Hace 42 días | Bicicleta · Jesús María |

Cada persona tiene su historial y estado de cuenta. Solo Valeria está bloqueada. Los días son relativos a la referencia de la sesión, visible en los controles; las fechas y horas se muestran en Lima (UTC−5). El caso de 10 días todavía no cumple el umbral de reactivación.

Elena declara explícitamente una pausa y comienza con invitaciones desactivadas; sigue teniendo acceso voluntario al programa. Esta declaración es simulada y no se deduce de su historial. Sus preferencias pueden modificarse desde **Mensajes y recordatorios**.

**Metas del perfil**, dentro de los controles, permite guardar objetivos personales opcionales de texto libre, uno por línea. No son promesas de ingresos y no modifican la estimación. Metas, preferencias, opciones, entregas y progreso se guardan por perfil durante la sesión. **Reiniciar perfil** afecta únicamente al seleccionado; **Reiniciar demostración** restaura los ocho casos. Las etiquetas se actualizan al simular entregas, incluso en las opciones de perfiles que no están seleccionados.

## Sesión reproducible — solo para esta demo

- **Abrir o recargar `/`** prepara un caso limpio de Camila. No conserva las acciones de una presentación anterior.
- Una **entrada externa directa** prepara el escenario inicial del perfil ficticio del enlace. Un enlace inválido o de un perfil no elegible muestra un error.
- Navegar dentro de la app, cambiar entre entradas o seleccionar otro perfil **conserva** sus elecciones durante esa sesión. Volver al inicio mediante los botones no reinicia.
- Recargar una ruta de programa conserva la sesión de esa pestaña. Un enlace nuevo de programa sin sesión comienza con los datos iniciales.
- **Reiniciar demostración** restaura todos los perfiles: entregas, elegibilidad, conexiones, metas, preferencias, invitaciones, casos y solicitudes, opciones, recordatorios, inscripciones y seguimiento. También elimina los costos de presentación guardados del panel independiente.
- **Reiniciar perfil** restaura únicamente la persona elegida.
- Los datos del celular están en `sessionStorage`, clave `vuelve-a-tu-ritmo:session:v3`. La referencia temporal se fija por pestaña en `vuelve-a-tu-ritmo:session-reference:v3`; los historiales iniciales se calculan respecto a ella.
- Las claves anteriores de la demo en `localStorage` no se leen y se retiran al reiniciar. No se usa `localStorage.clear()` ni se borran datos ajenos.

Este comportamiento de reinicio automático **no corresponde a una aplicación real**: se implementa para poder repetir la presentación sin que las entregas simuladas vuelvan inelegible al perfil inicial.

## Rutas

Todas utilizan el documento principal con parámetros de consulta, sin depender de rutas de servidor adicionales:

| Ruta | Uso |
| --- | --- |
| `/` | Presentación limpia de Camila |
| `/?invite=pilot-demo-inactive-recent` | Invitación externa directa y caso limpio |
| `/?program=inactive-recent` | Programa; continúa la sesión disponible |
| `/?settings=messages` | Preferencias y acceso a opciones con recordatorios |
| `/?help=support` | Ayuda y casos simulados del perfil seleccionado |
| `/?connect=inactive-recent` | Pantalla de confirmación voluntaria |
| `/?operations=pilot` | Cohorte ficticia independiente |
| `/?invite=invalido` | Error de enlace con regreso al inicio |

El botón del presentador reabre la misma invitación si sigue pendiente. Si ya hubo inicio, respuesta o rechazo, permite ver un **ejemplo** que no registra otro contacto ni altera preferencias. El acceso voluntario al programa continúa disponible si la cuenta y su historial lo permiten.

## Reglas y datos

- Elegibilidad: cuenta habilitada, entrega completada previa y al menos 15 días desde la última completada.
- Pausas: 15–30, 31–60 y más de 60 días. La prioridad del piloto se muestra al presentador; no deduce motivos ni cambia pedidos, rangos o beneficios.
- Estimación: tabla fija en `src/data/projectionRates.ts`, por zona, franja y vehículo; rango horario multiplicado por duración. Se restan únicamente los gastos ingresados. **Auto** permite demostrar una combinación sin datos, sin inventar un resultado.
- Comparación: hasta dos configuraciones, con gastos independientes y sin elegir automáticamente la de mayor ingreso.
- Soporte: abrir un caso o solicitar ayuda no cambia su estado a resuelto. Los estados los cambia el presentador.
- Reactivación: solo una entrega completada posterior al inicio del programa. Abrir, guardar y conectarse no cuentan.
- Operaciones: 24 participantes ficticios independientes; las acciones del celular no actualizan esa cohorte. Sus cifras no prueban impacto real.

Componentes visuales en `src/components`, reglas en `src/domain`, ejemplos en `src/data` y adaptadores en `src/services`. La separación permite sustituir datos simulados por una API posteriormente.

## Verificar

Requiere Node 24 o posterior para las pruebas TypeScript con el runner de Node:

```bash
npm test
npm run build
# Con el servidor local en ejecución:
npm run test:browser
```

La suite incluye reglas de negocio y 14 escenarios de navegador: ocho perfiles y metas independientes, interno y externo, tamaños 360/390/escritorio, cálculo, comparación, ayuda, preferencias, recordatorios, conexión voluntaria, entrega posterior, recarga/reinicio, rutas directas y Operaciones.

En Windows usa Edge instalado. `BROWSER_CHANNEL` permite otro canal; en otros sistemas puede ser necesario instalar Chromium de Playwright. `DEMO_URL` permite probar un despliegue. `npm run test:browser -- --smoke` ejecuta seis recorridos de publicación, incluidos perfiles y ayuda opcional. `SCREENSHOT_DIR` guarda capturas. Los contextos de prueba son aislados y no modifican los perfiles del navegador del presentador.

## Vercel

`vercel.json` configura Vite, `npm run build` y `dist`; `.vercelignore` excluye pruebas, capturas y documentación del despliegue. El proyecto está asociado a **vuelve-a-tu-ritmo** en **salex3**.

```bash
npx vercel@latest deploy --prod --yes --scope salex3
```

## Pendiente para un piloto real

Integración con cuentas y entregas verificadas, estimaciones validadas, campañas publicadas, soporte efectivo, conexión y contactos reales consentidos. También hace falta probar usabilidad con repartidores y medir retorno y continuidad frente a un grupo de comparación. Las revisiones anteriores en `docs/revision-hu*.md` documentan entregas previas; esta guía describe el comportamiento actual.
