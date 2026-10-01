# A-11 · Pausa y preferencias · Revisión del motor

Alcance de motor en `feat/motor-operaciones`; se conservan las entregas anteriores y el contrato. No se modifican pantallas ni navegación del repartidor.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Activar, editar y terminar pausa | `activatePause`, `updatePause`, `endPause`, con propiedad por perfil, validaciones, revisión y requestId. Una pausa vencida no puede editarse como activa. | Pantallas y confirmaciones. |
| Sin fecha final y motivo opcional | `endsAt: null` y `reason: null`; fecha final elegida debe ser futura ISO UTC y motivo no vacío de hasta 280 caracteres. | Campos opcionales; convertir ausencia a null. |
| Estado actual de permisos y canales | `getProfile` devuelve `preferences`, `contactPermission` efectivo y `pause`; `updatePreferences` modifica permisos y canales explícitamente. | Mostrar consentimiento almacenado y permiso efectivo por separado. |
| Desactivar contactos | Desactivar invitaciones o su canal cancela seguimientos de ese canal; retirar consentimiento cancela seguimientos y recordatorios; desactivar recordatorios cancela pendientes. No bloquea acceso voluntario. | Controles de preferencias y aclaraciones. |
| Crear, editar y cancelar recordatorios | `scheduleReminder` crea o edita usando `reminderId`; requiere consentimiento true, permiso específico, opción propia y fecha futura ISO UTC. `cancelReminder` cancela pendientes. | Selector de fecha/hora de Lima y conversión a UTC. |
| Pausa suspende contactos, permite consultas | La pausa cancela recordatorios y seguimientos pendientes, bloquea contactos nuevos y mantiene consultas, cálculo, comparación, guardado, ayuda e inicio voluntario disponibles para perfiles habilitados. `mentor.text` explica la consulta voluntaria durante pausa. | Explicación visible y navegación voluntaria. |

## Revisión y cambios

El ciclo de pausas y preferencias ya estaba implementado. Se refuerza la validación de entradas incompletas en pausa y recordatorios para devolver errores acordados, sin escrituras parciales. Se agregan pruebas específicas de pausa indefinida, cambios y finalización, preferencias, canales apagados, acceso voluntario, recordatorios con hora UTC, edición y cancelación, vencimiento, recarga, aislamiento y reintentos.

Pausar no modifica las preferencias declaradas. Terminar o vencer la pausa no reactiva recordatorios cancelados ni contactos anteriores, no habilita permisos y no genera mensajes. Los permisos que ya existían pueden volver a ser efectivos después de terminar la pausa; no se interpreta como consentimiento nuevo ni ejecución automática. Habilitar un permiso tampoco programa un recordatorio.

Invitaciones y recordatorios tienen permisos separados según el contrato: `allowProgramInvitations` y `channels` controlan invitaciones; `remindersAllowed` controla recordatorios solicitados. `Reminder` no define canal de envío. Para desactivar todos los contactos, enviar ambos permisos false y los canales false; `consentRecordedAt: null` también retira el consentimiento. No se trata desactivar únicamente invitaciones como retirada de un recordatorio ya solicitado.

Un recordatorio cancelado no se edita ni reactiva: se requiere una nueva intención explícita sin `reminderId`. Todas las fechas con hora son ISO UTC y el resultado identifica `America/Lima`; la interfaz muestra y recoge la hora local. La ejecución de recordatorios es un control administrativo simulado separado, nunca un envío real ni una acción automática de consulta.

## Acuerdo de integración

**Ningún criterio requiere ampliar el contrato actual.** Se reutilizan métodos, permisos, canales y fechas existentes. Si se quisiera seleccionar canal de envío de cada recordatorio, sería necesario acordar `channel: 'app' | 'external'` en `Reminder` y en `scheduleReminder`, incluyendo migración y validación; no es necesario para A-11 y no se implementa unilateralmente.

## Pruebas

Se ejecuta `npm test`, incluyendo `tests/mentorPausePreferences.test.mjs` y las pruebas anteriores de pausas, opciones, contactos y recordatorios. Se verifica TypeScript con `node node_modules/typescript/bin/tsc -b` y se revisa el diff.
