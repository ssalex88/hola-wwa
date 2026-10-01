# A-02 · Presentación de Rappi Mentor · Revisión del motor

Alcance: rama `feat/motor-operaciones`, reglas y respuestas del servicio. No se modifican pantallas, navegación, contrato ni preferencias de contacto para simular el cierre de una tarjeta.

| Criterio | Soporte del motor | Pendiente de integración de la interfaz |
| --- | --- | --- |
| Explicación breve | `getProfile().data.mentor.text` devuelve «Revisa cuánto podrías obtener según tu tiempo y zona.» en la presentación general de un perfil elegible. | Mostrar la explicación en la tarjeta. |
| Calcular una salida | `mentor.actions` comienza por `calculate` en la presentación general; se reutiliza `calculateProjection`. | Renderizar «Calcular una salida» como acción principal y conectarla al recorrido. |
| Adaptación a meta declarada | El consejo menciona el nombre de la única meta `active`, también al editarla y recargar. Metas archivadas/completadas no personalizan el mensaje. El avance no altera la proyección. | Mostrar el mensaje actualizado desde el snapshot. |
| Cerrar y reencontrar desde menú | Consultar el perfil no inicia el programa, registra contactos, cambia revisiones ni genera ingresos/aportes. El acceso voluntario no requiere consentimiento de invitaciones. | Cierre de tarjeta y acceso del menú: exclusivamente interfaz. El contrato no define una escritura de cierre persistente; no se añade una ni se usa `decline`, pausa o preferencias para ocultar la tarjeta. |
| Pausa, acceso y no elegible | `pause.status`, `profile.accountStatus`, `eligibility` y `contactPermission` ya existen. El consejo diferencia acceso bloqueado, pausa y falta de elegibilidad. La pausa permite consulta voluntaria cuando el perfil cumple condiciones; bloquea contactos. Una intervención iniciada elegiblemente permite continuar después de regresar aunque deje de cumplir los días de inactividad. | Estados visuales, jerarquía y accesibilidad. Para impedir acceso por cuenta bloqueada, este estado tiene prioridad. La elegibilidad actual y el acceso a una intervención existente se presentan por separado. |
| Sin culpa ni ingresos garantizados | Mensajes neutrales y condicionales; la meta se describe como declarada, sin prometer alcanzarla. Se mantienen `simulated: true`, `guaranteed: false` y supuestos de proyección. | Mantener ese lenguaje en títulos, botones y demás textos de la pantalla. |

## Cambios y reutilización

`src/domain/mentorRules.ts`: se adapta `adviceFor`; las reglas de elegibilidad, metas, pausas, persistencia y `refreshSnapshot` se reutilizan. El mensaje se deriva del estado vigente en consultas y escrituras, sin agregar campos al esquema ni cambiar firmas del contrato. Las necesidades ya expresadas conservan sus acciones de ayuda; el mensaje de presentación general se usa cuando no hay una necesidad específica. Los estados de acceso, falta de elegibilidad y pausa tienen prioridad sobre la personalización de meta.

No se agrega métrica a Operaciones: A-02 no solicita medir exposición ni cierres y una lectura del snapshot no debe producir eventos de intervención o contacto.

## Pruebas relacionadas

```sh
node --test tests/mentorPresentation.test.mjs tests/mentor.local.test.mjs tests/mentor-contract-source.test.mjs tests/eligibility.test.mjs
node node_modules/typescript/bin/tsc -b
```

Las pruebas de A-02 cubren presentación sin efectos secundarios, acciones semánticas, metas activas y su ciclo de vida, aislamiento, recarga, pausa/vencimiento, cuenta bloqueada, perfiles excluidos, necesidades explícitas y continuidad tras regresar. La suite existente comprueba permisos, reintentos, persistencia y reglas de negocio; la prueba de contrato verifica que las firmas compartidas permanezcan intactas.
