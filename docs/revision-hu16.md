# HU-16 · Consultar mi regreso y continuar a mi ritmo

## Criterios

| Criterio | Implementación |
| --- | --- |
| Entrega posterior al inicio | El primer acceso al programa registra una fecha de inicio por perfil. El regreso se calcula con la primera entrega completada estrictamente posterior a ese inicio y dentro del tiempo observado de la demo. Se conserva el inicio original al volver a entrar. |
| Sin reactivación por consultas | Abrir el inicio, guardar una propuesta, confirmar conexión o agregar una entrega cancelada no registra el regreso. Las entregas anteriores, iguales al inicio, inválidas o posteriores al tiempo observado quedan fuera. |
| Entregas desde controles | «Controles de demo → Entregas y regreso» permite agregar una entrega completada o cancelada, con identificador y fecha. Cada acción avanza un minuto la línea de tiempo del perfil y muestra el resultado del seguimiento. Las cuentas bloqueadas no pueden agregar entregas. |
| Pregunta opcional | Después del regreso, el inicio muestra «¿Cómo te fue al volver?», con Me fue bien, Más o menos, Tuve un problema y opción para omitir. La respuesta es editable y persiste por perfil. |
| Ayuda por problemas | «Tuve un problema» ofrece orientación hacia Ayuda o Soporte de Soy Rappi y permite consultar los casos y solicitudes simulados de HU-13. Solicitar ayuda no cambia el estado del caso. |
| Otra proyección o salida | «Consultar una nueva proyección» y «Preparar otra salida para guardar» abren la configuración. El programa sigue disponible para un perfil que regresó, aunque ya no sea elegible para una invitación de reactivación. Guardar la nueva salida exige una decisión explícita. |
| Sin recordatorios ni compromisos | Registrar una entrega, contestar la pregunta o preparar otra salida no crea reservas, conexiones, contactos ni recordatorios. Una nueva propuesta guardada mantiene su recordatorio desactivado. |

## Fechas de la demo

El inicio de intervención se define como la primera entrada válida a «Vuelve a tu ritmo», desde la tarjeta, el menú o la ruta compartida con la invitación externa. Abrir únicamente el inicio o la vista previa externa no registra este inicio.

Las entregas agregadas desde controles avanzan únicamente el tiempo observado del perfil en un minuto. Este tiempo se utiliza para la elegibilidad, duración de la pausa y validación del regreso, sin tratar la entrega simulada como una fecha futura inválida. La fecha global de las proyecciones y recordatorios permanece fija para reproducir la demo; no se ejecutan tareas por avanzar la línea de entregas.

Un historial anterior sin fecha de intervención no se interpreta como regreso. Los datos de versiones anteriores reciben un seguimiento vacío; el siguiente acceso válido registra el inicio. Reiniciar el perfil elimina su seguimiento, entregas agregadas y respuesta, y restaura su historial inicial.

## Probar

1. En Camila, abre el programa y consulta una proyección. Guarda o confirma una conexión si deseas demostrar que esas acciones no registran el regreso.
2. Vuelve al inicio: en «Entregas y regreso» aparece el inicio del programa y «Sin reactivación registrada».
3. Agrega una entrega cancelada. El regreso sigue sin registrarse.
4. Agrega una entrega completada. Aparece «Volviste a completar una entrega», con la fecha, identificador, cantidad desde el inicio y pregunta opcional.
5. Omite o responde. Recarga: se conservan la entrega, el inicio original y la respuesta.
6. Selecciona «Tuve un problema» → «Ver ayuda para mi regreso». Revisa un caso y registra una solicitud simulada; su estado permanece sin cambios.
7. Consulta una nueva proyección o prepara otra salida, calcula y guárdala voluntariamente. No se crea un recordatorio ni se conecta al perfil automáticamente.
8. Cambia de perfil y comprueba la separación. Reinicia Camila para volver al caso inicial.

## Arquitectura y pruebas

- `src/domain/returnTracking.ts`: inicio, reglas de reactivación, respuesta opcional y agregado de entregas de demo.
- `src/services/returnService.ts`: referencia observada del perfil y adaptación local para la futura API.
- `src/components/ReturnReview.tsx`: revisión del regreso, ayuda opcional y continuidad.
- `DemoControls.tsx`: único acceso para agregar entregas simuladas.
- `demoStorage.ts`: fechas, historial y respuesta separados por perfil, con lectura compatible de datos anteriores.
- `App.tsx`: permite continuar después del regreso y mantiene la elegibilidad para invitaciones separada de ese acceso voluntario.

Verificación: `npm test`, `npm run build` y `npm run test:browser` con Vite ejecutándose. Las pruebas cubren límites de fecha, historial anterior, cancelaciones, duplicados, inicio estable, persistencia, omisión, ayuda, continuidad y ausencia de automatismos. Edge comprueba el ancho de 360 px, errores JavaScript y solicitudes de escritura externas. Capturas en `artifacts/hu16/`.

Resultado: 45 pruebas de reglas y persistencia y compilación final aprobadas. Pasaron los 23 recorridos anteriores y los 2 nuevos de HU-16. Revisión visual del regreso y de la ayuda opcional a 360 px, sin controles recortados.

## Pendiente

La integración con entregas, tiempos y soporte reales requiere una API. La demo solo agrega registros ficticios; el cálculo prueba la definición del regreso, pero no demuestra que la intervención haya sido la causa de una entrega.
