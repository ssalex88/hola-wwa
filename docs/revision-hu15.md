# HU-15 · Solicitar un recordatorio

| Criterio | Implementación |
| --- | --- |
| Desactivado por defecto | Toda propuesta nueva y migrada recibe `reminder: null`; la opción «Quiero un recordatorio» comienza desmarcada. No se precargan fecha ni hora para el primer recordatorio. |
| Fecha y hora futuras explícitas | Activar la opción solo abre el formulario. «Guardar recordatorio» valida ambos campos y exige un instante estrictamente posterior a la referencia de la demo; admite el mismo día si la hora es futura. |
| Hora de Lima | Etiquetas, referencia y confirmación indican Hora de Lima (UTC−5). La conversión a UTC es explícita y no depende de la zona horaria del navegador. |
| Editar y cancelar | El formulario precarga un recordatorio existente para editarlo. Se puede cancelar con el botón o desactivar la opción. Estado y horario persisten por perfil y propuesta. |
| Eliminación de propuesta | El recordatorio pertenece a la copia guardada. Al eliminarla desaparece y deja de estar disponible en los controles de ejecución. |
| Ejecución desde controles | En el inicio, «Controles de demo → Recordatorios» ofrece «Simular ejecución del recordatorio». La simulación toma la fecha elegida como instante de ejecución, sin cambiar la referencia global. Se registra una sola ejecución; no hay temporizadores ni reintentos automáticos. |
| Sin notificación real | Formulario, confirmación y resultado de ejecución explican que no se envía una notificación al teléfono. No se utiliza una API de notificaciones ni se contacta a un servicio externo. |

## Probar

1. Consulta una proyección, responde u omite la ayuda opcional y guarda la propuesta.
2. Despliega «Opción guardada para este perfil»: el recordatorio está desactivado.
3. Marca «Quiero un recordatorio». Intentar guardar sin ambos campos, o con un instante pasado o igual a la referencia mostrada, presenta un error y no programa nada.
4. Selecciona una fecha y hora futuras en Lima y guarda. Recarga: se conserva. Ajusta la hora y pulsa «Guardar cambios del recordatorio».
5. Vuelve al inicio. En Controles de demo, simula su ejecución. Se muestra «Ejecutado en la demo · No se envió una notificación real» y no se permite repetir la misma ejecución.
6. Regresa a la copia para programarlo de nuevo voluntariamente, o cancelarlo. Eliminar la copia elimina también el recordatorio.
7. Cambia de perfil para comprobar la separación. Reiniciar un perfil elimina únicamente sus propuestas y recordatorios.

Editar la configuración de una propuesta conserva su recordatorio. Guardar una nueva copia no copia ni activa el recordatorio de otra propuesta. Los recordatorios voluntarios se administran separados de las invitaciones iniciales y las solicitudes de contacto de soporte.

## Arquitectura y verificación

- `src/domain/reminders.ts`: validación de fecha y hora, programación, cancelación y ejecución única a partir de la fecha programada.
- `src/services/reminderService.ts`: operaciones locales y simulación de ejecución para el presentador; preparado para adaptarse a una API.
- `src/components/ReminderEditor.tsx`: configuración opcional por copia guardada.
- `src/components/DemoControls.tsx`: ejecución simulada, separada de las acciones del repartidor.
- `demoStorage.ts`: persistencia y lectura de recordatorios; los registros ausentes o inválidos quedan desactivados.

Se verifica con `npm test`, `npm run build` y `npm run test:browser` con Vite en ejecución. Las pruebas cubren el límite temporal, cambio de día entre UTC y Lima, fechas inválidas, edición, cancelación, persistencia, ejecución única, eliminación de la propuesta y separación de perfiles. Edge verifica los recorridos a 360 px y la ausencia de desbordamiento, errores JavaScript y solicitudes de escritura a servicios externos. Capturas en `artifacts/hu15/`.

Resultado: 41 pruebas de reglas y persistencia, 23 recorridos en Edge a 360 px y compilación final aprobados. Consulta del recordatorio y ejecución desde controles revisadas visualmente, sin controles recortados.

## Pendiente

Un planificador y canales reales de notificación quedan fuera de la demo. La referencia fija permite reproducirla; la ejecución se realiza únicamente a petición del presentador. No se solicitaron permisos de notificación ni se enviaron avisos al teléfono.
