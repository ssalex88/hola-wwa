# HU-14 · Decidir si me conecto o guardo la propuesta

| Criterio | Implementación |
| --- | --- |
| Tres acciones | La propuesta actual, tras responder u omitir la ayuda opcional, ofrece «Ir a conectarme», «Guardar para después» y «Ahora no». |
| Abrir conexión sin conectarse | La primera acción navega a `?connect=perfil` y muestra una pantalla de conexión simulada. Abrirla, volver o recargar no confirma una conexión pendiente. |
| Confirmación voluntaria | Solo «Confirmar conexión simulada» modifica el estado. Se permite desconectarse voluntariamente. Cuenta bloqueada muestra orientación y no puede confirmar. |
| Guardar configuración y referencia | Colección independiente por perfil: zona, duración, modo de momento, fecha, franja, vehículo y gastos, junto con identificador, fecha/hora de referencia y versión de tabla. Las copias no cambian al editar la propuesta actual. |
| Consultar, editar, eliminar | Cada copia puede desplegarse, recuperarse, editarse o eliminarse. «Guardar cambios de propuesta» actualiza la copia seleccionada; guardar una nueva propuesta conserva las anteriores. |
| Sin reserva | La consulta, el guardado y la conexión explican que no reservan turnos ni implican compromiso de horario. |
| Recalcular y comprobar incentivos | Cada consulta usa el servicio de proyección y las reglas de incentivos actuales, no un monto guardado ni la lista anterior de ofertas. «Ahora» utiliza la franja de la referencia vigente; una fecha futura que ya no sea válida pide edición. |
| Contacto conservado | Guardar, editar, eliminar, salir y confirmar conexión no escriben las preferencias de invitaciones ni la solicitud voluntaria de contacto. |

## Probar

1. Abre una proyección y omite la ayuda opcional, o responde y continúa con la propuesta.
2. Pulsa «Ir a conectarme»: sigues desconectado. Vuelve sin confirmar para comprobarlo. Abre de nuevo y pulsa «Confirmar conexión simulada»; el encabezado indica conexión en la demo. Puedes desconectarte desde esa pantalla.
3. Pulsa «Guardar para después». Despliega la copia y consulta su referencia, rango e incentivos. Recarga: la copia persiste.
4. Pulsa «Editar propuesta guardada», ajusta campos y «Guardar cambios de propuesta». Se actualiza la misma copia. Recuperarla y guardar de nuevo permite mantener varias copias.
5. Elimina una copia; las otras y la propuesta actual se conservan. Cambia de perfil para comprobar su separación.
6. Pulsa «Ahora no»: vuelve al inicio, conserva preferencias de contacto y no conecta al repartidor.

## Arquitectura y verificación

- `src/domain/proposals.ts`: copias, actualización, eliminación y configuración para revisar.
- `src/services/proposalService.ts`: guardado con identificador y referencia de la demo.
- `src/components/SavedProposals.tsx`: consulta compartida por ayuda, decisión y configuración.
- `src/domain/connection.ts` y `src/components/ConnectionScreen.tsx`: confirmación explícita y pantalla de conexión.
- Persistencia por perfil en `demoStorage.ts`, con migración de la única copia guardada por las entregas anteriores. La referencia histórica desconocida de una copia antigua se identifica como migrada.

`npm test`, `npm run build` y `npm run test:browser` con Vite ejecutándose. Las pruebas cubren copias independientes, edición, borrado, persistencia, conexión voluntaria, bloqueo de cuentas, contacto conservado y reconsulta con una fecha posterior que cambia la franja y deja incentivos vencidos fuera del resultado. Los recorridos de navegador usan Edge a 360 px y comprueban desbordamiento, errores JavaScript y solicitudes de escritura externas. Capturas en `artifacts/hu14/`.

Resultado: 37 pruebas de reglas y persistencia y compilación final aprobadas. Pasaron los 18 recorridos anteriores y los 3 nuevos de HU-14. Pantalla de confirmación y propuesta guardada revisadas visualmente a 360 px, sin controles recortados.

## Límites

La fecha de referencia global permanece fija para reproducir la demo. Cada revisión vuelve a consultar las reglas con esa referencia; la prueba de reglas usa una fecha posterior para verificar vencimientos y cambios de franja. Un sistema real deberá proporcionar fecha, catálogo y datos vigentes desde una API. La conexión es local y simulada, no asigna pedidos ni registra entregas. Confirmarla no marca una reactivación, que requiere una entrega completada.
