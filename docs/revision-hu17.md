# HU-17 · Evaluar el piloto

## Alcance y procedencia

Panel de Operaciones en `?operations=pilot`, separado del inicio, el menú y las acciones del repartidor. Se puede abrir desde el enlace de Controles de demo.

Los resultados provienen de **24 participantes ficticios independientes de los seis perfiles interactivos**: 12 de intervención y 12 de comparación. No se suman las acciones del navegador a esta cohorte ni se presentan como resultados reales de Rappi. La cohorte contiene personas que entran al flujo, personas sin entrada, retornos espontáneos, retornos tardíos, rechazos y ventanas pendientes. La comparación simula personas sin exposición al programa.

## Criterios de aceptación

| Criterio | Implementación |
| --- | --- |
| Panel separado | Ruta y diseño propios de Operaciones; sin controles de conexión ni selector de repartidor. El regreso a la demo conserva el perfil y sus datos. |
| Asignados y resultados | Elegibles asignados, entradas al flujo, eventos de proyección y guardado, personas únicas y retornos observados para ambos grupos. |
| Origen | Entradas reales de la cohorte ficticia desglosadas en app e invitación externa; sin entrada se muestra aparte y no se inventa un origen. |
| Filtro de inactividad | Todos, 15–30, 31–60 y más de 60 días. La elegibilidad y el tramo se calculan al asignar y no se alteran por el regreso posterior. |
| Reactivación a 14 días | Retornos dentro de la ventana / todos los elegibles asignados al grupo. Incluye en el denominador a quienes no respondieron; incluye entregas observadas aunque no hayan entrado al flujo. |
| Continuidad 24–30 | Personas con una entrega en esa ventana / personas que regresaron. Se calcula desde la primera entrega de regreso y también incluye retornos posteriores a los 14 días. |
| Pendientes | Se muestran ventanas pendientes separadas de ventanas completas sin retorno o sin continuidad. Las tasas y costos son provisionales mientras haya seguimiento pendiente. |
| Rechazo y no contacto | Personas únicas que rechazaron, eligieron Ahora no, No me interesa o solicitaron no contacto. No responder no se etiqueta como rechazo. |
| Intervención y comparación | Tabla y tasas separadas, con tamaños de grupo visibles y datos simulados. |
| Costos | Tres costos adicionales de intervención, editables y persistentes por filtro. El costo por retorno adicional solo se calcula con diferencia positiva, denominadores presentes e importes válidos. |
| Resultados demostrativos | Identificación visible, procedencia y límites del cálculo en el panel. No presenta una diferencia ficticia como prueba causal. |

## Definiciones de medición

- **Asignación:** cuenta habilitada, al menos una entrega completada y 15 días o más de pausa en ese instante. Se deduplican identificadores.
- **Retorno observado:** primera entrega completada estrictamente posterior a la asignación y no posterior al corte observado. Cancelaciones, apertura, conexión y guardado no cuentan.
- **Reactivación a 14 días:** retorno hasta asignación + 14 × 24 horas, inclusive. La ventana está completa cuando la cobertura observada llega a ese límite.
- **Continuidad:** al menos una entrega desde regreso + 24 × 24 horas hasta antes de regreso + 31 × 24 horas. Son los días 24 a 30 completos; el seguimiento termina al llegar al día 31.
- **Pendiente:** el tiempo observado aún no completa la ventana. Un éxito temprano puede estar observado y continuar con ventana pendiente; no se convierte en fracaso.
- **Corte:** mínimo entre referencia del análisis y cobertura de observación de cada participante. Consultar con una fecha posterior sin nuevos datos no convierte un seguimiento incompleto en fracaso.
- **Costo incremental:** diferencia = tasa de intervención − tasa de comparación. Retornos adicionales estimados = diferencia × asignados de intervención. Costo por retorno adicional = suma de costos adicionales ingresados / retornos adicionales estimados. Normaliza tamaños de grupo distintos y no calcula para diferencia cero o negativa.

La referencia principal de HU-17 es la **asignación a grupo**, común para intervención y comparación; la medición posterior al inicio individual del flujo de HU-16 tiene otra finalidad. Esta separación permite conservar a quienes no respondieron y medir retornos espontáneos en ambos grupos, sin atribuir automáticamente una entrega al programa.

## Probar

1. Ejecuta `npm run dev`. Abre `?operations=pilot` o el enlace «Abrir panel de Operaciones · Resultados simulados» en Controles de demo.
2. En Todos los tramos, comprueba 12 asignados por grupo, 6 entradas de intervención (3 app y 3 externas), 9 consultas y 6 guardados. La reactivación observada es 6/12 frente a 5/12, con 3 ventanas pendientes en cada grupo.
3. Filtra 15–30: 4 asignados por grupo, 3 frente a 1 retornos a 14 días. Filtra 31–60: diferencia cero. Filtra más de 60: diferencia negativa. Los pendientes siguen identificados.
4. En Todos los tramos, introduce operación 50, incentivos otorgados 30 y soporte 20. El ejemplo calcula aproximadamente un retorno adicional y S/100 por retorno adicional, etiquetado provisional.
5. Cambia de filtro: sus costos son independientes. Una diferencia cero o negativa no muestra un costo por retorno adicional. Recarga para comprobar la persistencia de los importes.
6. Revisa continuidad, rechazos, no contacto y tarjetas por participante para auditar los denominadores y estados.

## Arquitectura y pruebas

- `src/data/pilotCohort.ts`: cohorte ficticia reproducible, con asignación, historial previo, entregas y eventos fechados.
- `src/domain/pilotEvaluation.ts`: elegibilidad al asignar, seguimiento, agregación, filtro y costo incremental.
- `src/services/pilotService.ts`: adaptación local y persistencia de costos por filtro; punto de reemplazo por una API.
- `src/components/OperationsPanel.tsx` y `operations.css`: panel independiente y responsive.

Verificación mediante `npm test`, `npm run build` y `npm run test:browser` con Vite ejecutándose. Las pruebas comprueban denominadores completos, no respuesta, retornos sin entrada, límites temporales, seguimientos pendientes, elegibilidad, duplicados, costos no positivos/invalidos, origen, filtros y persistencia. Edge verifica 360 px y 1280 px, ausencia de errores JavaScript y de solicitudes de escritura externas. Capturas en `artifacts/hu17/`.

Resultado: 51 pruebas de reglas y persistencia, 27 recorridos en Edge y compilación final aprobados. Revisión visual de reactivación y costos a 360 px y del panel en escritorio, sin controles recortados.

## Pendiente

Instrumentación y conexión con datos de un piloto real: asignación a grupos, eventos de entrada con origen, consultas, guardados, entregas, cobertura de seguimiento y costos verificados. No se efectuó una prueba causal, no se exportaron datos reales ni se enviaron comunicaciones.
