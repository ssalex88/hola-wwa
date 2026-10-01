# A-06 · Configurar una posible salida · Revisión del motor

Alcance: servicios, reglas y persistencia en `feat/motor-operaciones`. Se conservan todas las entregas anteriores. No se modifican pantallas, navegación ni el contrato 1.0.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Duración, momento, vehículo y zona | `ProjectionInput` existente y validaciones reutilizadas. Horas entre 1 y 12, franjas `Mañana/Tarde/Noche`, vehículos `Bicicleta/Moto/Auto`, zonas del catálogo. `getCatalog` devuelve zonas con id/etiqueta y vehículos. | Selectores y controles; enviar `zone` como etiqueta del catálogo, no como zoneId. |
| Duraciones sencillas | El motor acepta 1, 2 y 3 horas y calcula según la duración elegida, sin predeterminar una salida. | Botones rápidos y sus etiquetas. No se limita el rango acordado de 1–12 horas. |
| Modificar antes de calcular | `updateProgress` guarda una configuración válida sin ejecutar proyección. Descarta la estimación anterior y vuelve a `configuration` cuando no se indica otro paso. La configuración está aislada por perfil y persiste. | Conservar un formulario incompleto localmente; enviar la configuración completa cuando sea válida. Volver a calcular tras editar. |
| Consulta sin reserva ni conexión | Las consultas/configuraciones no cambian conexión, entregas, contactos ni inicio. Proyecciones disponibles incluyen la aclaración en `assumptions`, y las no disponibles en `message`. Opciones guardadas tienen `isReservation: false`. | Mostrar la aclaración antes de calcular y en los resultados; confirmar conexión por separado. |
| Validaciones y sin información | `VALIDATION` con `error.fields` para correcciones; `ok: true` con `status: unavailable`, `reason: missing-data` y configuración preservada para una combinación sin tarifas. | Errores por campo, carga y pantalla sin datos. No sustituir `unavailable` por un rango inventado. |

## Revisión y cambios

Se reutilizan catálogo, tarifas, reglas de configuración, copia de preferencias, calendario de Lima, proyecciones y persistencia existentes. No se agrega otra API de cálculo ni datos ficticios para combinaciones ausentes.

- Editar configuración sin indicar `step` restablece el paso de configuración; antes podía conservar `decision` con una estimación eliminada. Un `step` explícito mantiene la semántica acordada de `updateProgress`.
- Los gastos fuera del rango monetario admitido ahora identifican también su campo en `error.fields`, usando la validación de dinero existente y redondeo a dos decimales.
- Se añade «sin reserva ni conexión» en los campos de explicación ya existentes, sin cambiar tipos. Calcular mientras ya se está conectado tampoco desconecta: consulta y conexión son independientes.
- Al recargar se rechazan configuraciones incoherentes (`now` con fecha o `another-day` sin fecha). Una configuración antes válida con fecha ya vencida se conserva para poder corregirla; al calcular se pide elegir una fecha futura, sin perder el resto del formulario.

## Integración

La interfaz obtiene zonas/vehículos con `getCatalog`, permite editar un borrador y usa `updateProgress(ctx, { configuration })` para guardar elecciones válidas. `calculateProjection` recibe esa configuración completa, incluyendo gastos (0 cuando no se ingresen) y `scheduledDate: null` si es `now`. Otra fecha debe ser `YYYY-MM-DD` futura respecto al reloj del servicio en Lima.

La configuración incompleta no se persiste mediante este contrato: `ProjectionInput` exige todos los campos. No es necesario un método de borrador para cumplir A-06; el compañero puede mantener valores parciales en su formulario y mostrar las validaciones devueltas al intentar calcular. Un error revierte la escritura y conserva la última configuración válida.

Una combinación con `Auto` puede ser válida y no tener tarifas. Eso devuelve éxito `unavailable`, no un error del servicio. Estas consultas se cuentan como eventos de proyección, sin crear salida, turno, contacto ni ingreso. El acceso a una intervención y la elegibilidad siguen siendo reglas separadas.

## Acuerdo de integración

**Ningún criterio requiere ampliar el contrato actual.** Los tres momentos y botones 1/2/3 son opciones conocidas del acuerdo y presentación de la interfaz, validadas por el motor.

Si se desea que el servicio publique dinámicamente todas las opciones y etiquetas, `getCatalog` hoy solo tiene zonas y vehículos. Propuesta concreta para acordar: ampliar su resultado con `moments: Array<{ value: string; label: string }>` y `quickDurations: number[]`, reutilizando `PROJECTION_MOMENTS` y `[1, 2, 3]`. No está implementada ni es necesaria para los criterios actuales. Una API para persistir borradores incompletos también requeriría cambiar el contrato; no se añade unilateralmente.

## Pruebas relacionadas

```sh
node --test tests/mentorConfiguration.test.mjs tests/mentor.local.test.mjs tests/mentor-contract-source.test.mjs tests/program.test.mjs
node node_modules/typescript/bin/tsc -b
```

Cubren duraciones sencillas, edición y descarte de estimaciones, validación por campo, gastos, fechas de Lima, combinaciones sin datos, recarga, reintentos, aislamiento y ausencia de reserva/conexión. La interfaz de configuración, sus estados visuales y botones quedan pendientes de integración.
