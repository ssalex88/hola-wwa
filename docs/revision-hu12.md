# HU-12 · Consultar incentivos aplicables

Entrega limitada a HU-12 sobre el flujo existente. Catálogo totalmente ficticio: las publicaciones pertenecen solo a la demo y no representan ofertas de Rappi.

| Criterio | Implementación y verificación |
| --- | --- |
| Compatibilidad | Reglas explícitas de cuenta habilitada, historial previo completado, zona, fecha, franja y vehículo del perfil y de la simulación. Fechas o configuraciones inválidas no muestran campañas. Pruebas de dominio y navegador. |
| Información completa | Cada tarjeta presenta monto o beneficio, vigencia, zonas, franjas, vehículos, entregas requeridas e inscripción cuando corresponde. |
| Disponible frente a obtenido | Disponible, inscrito aún no obtenido y obtenido con confirmación ficticia. Camila incluye un registro de beneficio obtenido asociado a su historial inicial; la inscripción nunca crea una confirmación. |
| Campañas no publicadas | Borradores y publicaciones con fecha futura quedan ocultos. Se incluye un borrador en los datos para comprobarlo. |
| Sin incentivos | Mensaje explícito, posibilidad de cambiar opciones y continuar mediante las acciones existentes de la propuesta, sin inscribirse. |
| Pausas sin bonos | La duración de inactividad no interviene en la consulta ni en la inscripción. Prueba con historial antiguo conserva los mismos beneficios. |
| Inscripción sin otros efectos | Solo escribe el registro local de inscripción. Persiste al recargar y queda separado por perfil; no cambia proyección, gastos, historial, conexión ni prioridad. Inscripción repetida idempotente. |

## Arquitectura

- `src/data/conditionalIncentives.ts`: ejemplos ficticios y confirmación inicial de demostración.
- `src/domain/incentives.ts`: compatibilidad, estado e inscripción, funciones puras.
- `src/services/incentiveService.ts`: catálogo y fecha consistente de la demo; punto de adaptación a una API futura.
- `src/services/demoStorage.ts`: inscripciones y confirmaciones por perfil; lectura compatible con datos anteriores y reinicio por perfil.
- `src/components/IncentivePanel.tsx`: consulta compartida por propuesta actual, alternativas y opción guardada. Mantiene los incentivos separados del cálculo de ingresos.

## Verificación

`npm test`, `npm run build` y, con Vite ejecutándose, `npm run test:browser`. Los escenarios nuevos usan Edge a 360 px, verifican persistencia, separación de perfiles, campos de condiciones, ausencia de efectos en ingresos y conexión, estado vacío, continuidad y ausencia de solicitudes de escritura a servicios externos.

Resultado: 29 pruebas de reglas y persistencia y 16 escenarios de navegador aprobados. Compilación de producción correcta. Capturas de la consulta y del estado vacío en `artifacts/hu12/`; revisión visual de la consulta a 360 px sin controles recortados.

## Límites

No hay campañas reales, pagos, canjes, inscripción externa ni adjudicación por nuevas entregas. “Obtenido” es una confirmación inicial ficticia para demostrar la diferencia de estados. La validación de condiciones de entregas y su confirmación requerirá una API y datos verificados. Los importes condicionales nunca se suman al rango ni al resultado después de gastos.
