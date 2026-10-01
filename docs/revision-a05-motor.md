# A-05 · Alcancía visual · Revisión del motor

Alcance: servicios, reglas y persistencia en `feat/motor-operaciones`. Se conservan las entregas anteriores. No se modifican pantallas, navegación ni el contrato 1.0.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Objetivo, aportes y pendiente | `goals[].targetAmount`, `contributions[]` y `goalProgress[]` incluyen suma declarada, pendiente, porcentaje y `targetReached`, relacionados por `goalId`. | Alcancía, lista de aportes y presentación de soles. |
| Aporte manual con monto/fecha | `saveContribution` exige meta del perfil, monto positivo en PEN y fecha `YYYY-MM-DD` de Lima no futura. Guarda `source: manual` y fechas de registro/actualización ISO UTC. | Formulario y errores. La fecha del aporte es local y no debe convertirse a un instante de otra zona horaria. |
| Corregir/eliminar | `saveContribution` con `contributionId` corrige monto/fecha conservando id, meta y fecha de creación; `deleteContribution` elimina y recalcula. | Acciones y confirmaciones. |
| Registro personal sin guardar/transferir dinero | Solo se guardan datos declarados en la sesión local. No existe saldo financiero, custodia, pago o transferencia. Operaciones muestra «Aportes manuales declarados». | Aclaración visible: «Es un registro personal. No guardamos ni transferimos dinero». |
| Sin sumar proyecciones/ingresos | Solo las escrituras explícitas de aportes alteran su suma. Calcular, comparar, guardar, inscribir incentivos, conectar o registrar entregas no agregan aportes. | Mantener separados el cálculo de una salida y el registro manual; no llamar `saveContribution` automáticamente. |
| Mensaje al completar | `targetReached` señala si la suma llega al objetivo; `Goal.status: completed` registra una decisión manual distinta. No se cambia estado automáticamente. | Mensaje sencillo y accesible, sin prometer ni afirmar ingresos verificados. |

## Revisión y corrección

Se reutilizan `saveContribution`, `deleteContribution`, el cálculo de avance en centavos, revisiones, idempotencia y aislamiento existentes. Las correcciones y eliminaciones recalculan suma/pendiente/porcentaje; pueden deshacer `targetReached`. El pendiente nunca es negativo. Si la suma supera el objetivo, el porcentaje puede superar 100%; la interfaz puede limitar el dibujo de la barra sin modificar los datos declarados.

Se reforzó la validación al recuperar una sesión: no se admiten aportes futuros respecto al día observado en Lima, fechas de actualización futuras o anteriores a creación, ni totales por meta fuera del rango seguro en centavos. Se aplica la misma restricción de suma que ya existía al registrar aportes. Una sesión inválida se rechaza según la recuperación existente del motor; no se muestran cantidades corruptas ni se ejecutan contactos. No se cambia el esquema ni se alteran claves ajenas.

La corrección conserva pertenencia a perfil y meta. No se permite mover un aporte a otra meta mediante una edición. El dinero se redondea a dos decimales antes de sumarse. El total de Operaciones usa los aportes actuales: corregir o eliminar no deja el importe anterior como si siguiera declarado.

## Completado e integración

Para una meta recién alcanzada (`targetReached` pasa de false a true), la interfaz puede mostrar: «Llegaste al monto de tu meta según tus aportes registrados». Tras una corrección/eliminación que lo deje en false, debe reflejar el nuevo pendiente.

Para `changeGoalStatus(..., { status: completed })`, el mensaje puede ser «Marcaste esta meta como completada». Ese estado no equivale a tener el dinero: puede existir con `targetReached: false`. Completar no agrega aportes, paga, conecta ni activa recordatorios.

**Ningún criterio de A-05 requiere ampliar el contrato.** El compañero dispone de datos y métodos para la alcancía y sus mensajes. No se agregan `balance`, `transfer`, `completionMessage` ni escrituras de ahorro automático. Los textos visuales quedan en su interfaz.

## Pruebas relacionadas

```sh
node --test tests/mentorContributions.test.mjs tests/mentorGoals.test.mjs tests/mentor.local.test.mjs tests/mentor-contract-source.test.mjs
node node_modules/typescript/bin/tsc -b
```

Cubren suma y centavos, pendiente y meta alcanzada, corrección/eliminación, monto/fecha inválidos, pertenencia, cambios de objetivo, recarga, reintentos, datos corruptos y límites numéricos. Verifican que el flujo de salida, incentivos y entrega no sume dinero al registro, y que un aporte tampoco active contactos o el programa. La interfaz de alcancía y las confirmaciones quedan pendientes de integración.
