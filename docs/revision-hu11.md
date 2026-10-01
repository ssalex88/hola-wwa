# HU-11 · Acción según la necesidad expresada

La pregunta “¿Qué necesitarías para que te convenga volver?” aparece debajo del rango, los gastos y los supuestos, después de mostrar la primera proyección. Se puede omitir o cambiar la respuesta. Las respuestas, la opción guardada, el contacto solicitado y el paso de la propuesta se guardan por perfil en almacenamiento local.

| Respuesta | Acción disponible | Regla y límite mostrado |
| --- | --- | --- |
| Que me salga más a cuenta | Abrir la comparación de dos opciones y saltar al apartado de incentivos de la estimación. | Los incentivos se muestran separados. HU-12 añade campañas ficticias compatibles e inscripción local; no se añade dinero al rango. |
| Encontrar tiempo | Cambiar la duración de 1 a 12 horas o guardar una copia de la propuesta actual. | Al cambiar horas se recalcula el rango. La copia conserva zona, fecha, franja, vehículo, duración y gastos aunque se edite la propuesta actual; puede recuperarse o eliminarse. Guardar no reserva horas ni conecta. |
| Problema de pago o pedido | Ver una orientación para hallar Ayuda o Soporte de Soy Rappi y buscar pagos o pedidos. | La demo no abre casos ni contacta al soporte; se indica que la ruta puede variar. |
| Problema personal o del vehículo | Posponer sin contacto o elegir una fecha futura y guardar, actualizar o cancelar una solicitud de contacto de demostración. | Posponer sin contacto conserva una copia de la opción y cancela una solicitud anterior. Escribir una fecha no programa nada: hay que confirmarla. No se envía ningún mensaje y la solicitud no garantiza respuesta o solución. |
| Otro | Continuar hacia el resumen de la propuesta actual. | Se puede revisar la proyección o volver al inicio sin conectarse. |
| Omitir | Continuar directamente hacia el resumen de la propuesta actual. | No se exige una segunda respuesta ni confirmación; se puede volver a la ayuda opcional. |

Las recomendaciones son un mapeo explícito de respuesta a acción en `src/domain/returnHelp.ts`. No se usan IA, inferencias sobre la causa de la pausa, promesas de solución o prioridad ni ajustes al rango estimado. El soporte y el contacto futuro permanecen simulados.

## Verificación

- Compilación de producción correcta.
- 25 pruebas de reglas y persistencia pasaron, incluyendo guardar copias, migrar la marca de guardado de la versión anterior y validar solicitudes de contacto.
- 14 escenarios de navegador pasaron a 360 px, cinco específicos de HU-11: ahorro, tiempo, soporte, posponer/contacto, Otro/omisión. Los escenarios anteriores comprueban que las entradas y preferencias conservan su comportamiento.
- No se observaron errores de JavaScript, controles fuera de pantalla ni solicitudes HTTP de escritura durante los recorridos. Abrir la propuesta, omitir y continuar no modifica las entregas ni el estado de conexión.
- Las capturas en `artifacts/hu11/` se revisaron visualmente.

Para probar solo HU-11 con Vite activo:

```bash
npm run test:browser -- --hu11
```

Para probarlo manualmente, selecciona un perfil elegible, consulta una proyección y usa la pregunta opcional debajo de los gastos. “Cambiar mi respuesta” permite probar cada ruta. Guardar, salir y volver desde el menú conserva la copia por perfil. La conexión, el soporte y el envío real de contactos siguen fuera del alcance de esta HU.
