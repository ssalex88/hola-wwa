# A-08 · Proyección y comparación · Revisión del motor

Alcance: motor en `feat/motor-operaciones`, conservando entregas anteriores. No se modifican contrato, pantallas ni navegación del repartidor.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Rango, gastos y resultado posterior | `Projection.result` incluye `grossMin/grossMax`, `expenses` y `afterExpensesMin/afterExpensesMax`, en PEN. Solo se restan gastos ingresados; un resultado negativo se conserva. | Presentar importes y rango sin prometer ingresos. |
| Ajustar gastos | `ProjectionInput` admite combustible, mantenimiento y otros; valida montos, redondea centavos y comprueba el total. `updateProgress` guarda cambios e invalida la estimación anterior; calcular produce otra estimación. | Edición de gastos y acción de recalcular. |
| Comparar dos alternativas | `compareProjections` devuelve dos resultados independientes y no elige ganador. Una alternativa puede no tener datos. Una entrada inválida revierte toda la operación. | Comparación visual, edición y elección voluntaria. |
| Supuestos desplegables | `assumptions` explica tabla ficticia, gastos, incentivos, zona, ausencia de reserva y contexto de meta activa. | Sección desplegable y lectura de los supuestos. |
| Incentivos aparte, condiciones y vigencia | `incentives` separado del rango con requisitos, zonas, inscripción, estado, importe o beneficio y vigencia ISO UTC. Reutiliza filtros de publicación, perfil, vehículo, zona, franja y fecha elegida. No aumenta la proyección ni los aportes. | Presentar condiciones y fechas en hora de Lima; distinguir beneficio de dinero. |
| Relación con la meta sin ahorro automático | Se agrega en `assumptions` el nombre de la meta activa y saldo pendiente según aportes manuales, aclarando que consultar no registra ahorro ni completa la meta. `getProfile` conserva meta y progreso como datos estructurados. | Mostrar la relación junto al resultado; refrescar el perfil si se edita la meta. |
| Carga, error y ausencia de datos | Métodos asíncronos; errores acordados con rollback; `unavailable` y `missing-data` sin cifras inventadas. No tener datos es éxito, distinto de `UNEXPECTED`. | Indicador de carga, mensajes de error y presentación sin información. |

## Implementación y límites

Se reutilizan cálculo, comparación transaccional, tarifas, filtros de incentivos y persistencia. Los cambios de A-08 son el contexto de meta en los supuestos y la validación del total de gastos para impedir desbordamientos del rango monetario permitido. No se modifica el cálculo compartido de las pantallas existentes.

Los supuestos de meta reflejan el instante del cálculo; no son una vinculación permanente ni agregan un `goalId` a la proyección. Después de cambiar metas o aportes, se consulta `getProfile` para el saldo actual o se vuelve a calcular. No se convierten rangos en un ahorro esperado, porcentaje garantizado ni fecha de cumplimiento. Las proyecciones disponibles persisten por perfil; los reintentos conservan la respuesta original. La comparación no reemplaza automáticamente `currentProjection` ni decide por el repartidor.

## Acuerdo de integración

**Ningún criterio requiere ampliar el contrato actual.** La relación textual usa `assumptions` y la relación visual puede utilizar `ProfileSnapshot.goals` y `goalProgress` del mismo perfil. Para una futura relación histórica estructurada, sería necesario acordar explícitamente `goalId: string | null` y el saldo de referencia en la variante disponible de `Projection`; esa ampliación no es necesaria para A-08 y no está implementada.

## Verificación

`tests/mentorProjections.test.mjs` cubre ajuste y redondeo de gastos, neto negativo, comparación independiente y parcial sin datos, rollback, meta sin aportes automáticos, incentivos y vigencia UTC, total de gastos fuera de rango, recarga, aislamiento y reintentos. Se ejecuta junto con las pruebas del motor y las historias anteriores mediante `npm test`, y se comprueba TypeScript con `node node_modules/typescript/bin/tsc -b`.
