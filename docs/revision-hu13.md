# HU-13 · Acceder a ayuda por un problema pendiente

## Criterios de aceptación

| Criterio | Resultado implementado |
| --- | --- |
| Seleccionar pago o pedido | Desde «Problema de pago o pedido» → «Ver ruta de ayuda», un selector ofrece dos casos ficticios del perfil. |
| Identificador, descripción y estado | Detalle del caso seleccionado con estado Pendiente, En revisión o Resuelto. |
| Solicitud de ayuda simulada | Botón explícito registra la solicitud y su fecha de referencia en hora de Lima. La confirmación persiste por caso y perfil, sin duplicarse. No contacta servicios externos. |
| Sin resolución automática | Seleccionar, abrir, registrar una solicitud y volver no escriben el estado del caso. Tampoco modifican ingresos, entregas o conexión. |
| Estados desde controles de demo | En el inicio, el apartado «Estados de casos · Solo para presentar» permite cambiar cada estado. El repartidor no dispone de esta acción en la consulta de ayuda. |
| Volver conservando elecciones | «Volver a la proyección» cierra la consulta y vuelve al resumen, conservando zona, fecha, franja, vehículo, duración, gastos y alternativas. |

## Datos y arquitectura

- Datos ficticios: `src/data/supportCases.ts`. Cada perfil tiene sus propios identificadores. El perfil sin entregas no tiene casos.
- Reglas: `src/domain/support.ts`. La solicitud no resuelve el caso; una solicitud ya registrada no se duplica; un caso resuelto no acepta una nueva solicitud.
- Servicio local: `src/services/supportService.ts`, preparado para reemplazarse por una API.
- Vista: `src/components/SupportPanel.tsx`, integrada con la ayuda existente de HU-11.
- Persistencia: selección, solicitudes y estados se guardan por perfil. Datos anteriores reciben los casos iniciales; referencias desconocidas o datos inválidos se descartan. Reiniciar un perfil restaura únicamente sus propios casos y borra sus solicitudes.

## Probar manualmente

1. Ejecuta `npm run dev`, selecciona Camila, abre el programa y consulta una proyección.
2. Elige «Problema de pago o pedido», abre «Ver ruta de ayuda» y selecciona Pago. Comprueba el identificador, la descripción y el estado Pendiente.
3. Registra una solicitud de ayuda simulada: aparece la confirmación y el caso sigue Pendiente. El botón queda deshabilitado para evitar solicitudes duplicadas.
4. Selecciona Pedido y comprueba su estado En revisión. Vuelve a la proyección; se mantienen los valores elegidos.
5. Vuelve al inicio. En Controles de demo cambia el caso de pago a En revisión o Resuelto. Regresa al programa y comprueba el cambio. Recarga: se conservan solicitud, selección y estado.
6. Cambia a Marco: sus casos tienen identificadores y solicitudes independientes. Reinicia Camila para restaurar sus casos sin afectar a Marco.

## Verificación

Pruebas de reglas y persistencia mediante `npm test`; compilación mediante `npm run build`; recorridos de aceptación a 360 px mediante `npm run test:browser` con Vite en ejecución. Los escenarios de navegador verifican además ausencia de desbordamiento horizontal, errores JavaScript y solicitudes de escritura a sistemas externos. Capturas en `artifacts/hu13/`.

Resultado: 33 pruebas de reglas y persistencia aprobadas y compilación correcta. Pasaron los 16 recorridos anteriores y los 2 nuevos de HU-13. Los nuevos recorridos verifican pago y pedido, solicitudes persistentes sin cambiar estados, regreso con elecciones intactas, cambios desde controles de demo, separación de perfiles y reinicio. Consulta revisada visualmente a 360 px.

## Pendiente

Integración con soporte real, sincronización de estados y seguimiento de solicitudes externas. La demo guarda registros locales; no abre tickets reales, garantiza respuestas ni resuelve problemas automáticamente.
