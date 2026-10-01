# A-07 · Zonas y rutas cercanas · Revisión del motor

Alcance: servicios, reglas, catálogo de demostración y persistencia en `feat/motor-operaciones`. Se conserva el trabajo anterior, las pantallas y navegación del repartidor y el contrato compartido.

| Criterio | Soporte del motor | Pendiente de interfaz |
| --- | --- | --- |
| Elegir zona manualmente | `getCatalog` conserva las cinco zonas; `updateProgress` valida y guarda la configuración por perfil. | Selector manual. |
| Origen y destino de ruta simulada | `exploreRoute` valida identificadores y devuelve coincidencias de corredores ficticios internos, incluyendo zonas intermedias. | Formulario y presentación de simulación. |
| Zonas cercanas de demostración | Consulta con origen igual a destino devuelve la zona y sus asociaciones cercanas ficticias. Se reutiliza `RouteQuery`, sin nuevas propiedades. | Elegir zona de referencia y presentar coincidencias; no inferir ubicación GPS. |
| Llevar zona al simulador | Usar la etiqueta `Zone.label` en `ProjectionInput.zone`, guardar mediante `updateProgress` y calcular con la misma configuración. Persiste por perfil, con revisión y requestId. | Acción para seleccionar y navegar al simulador. |
| Sin coincidencias, selección manual | Un par válido sin escenario devuelve éxito con `zones: []`; `getCatalog` sigue disponible. | Mensaje sin coincidencias y acceso al selector manual. |
| Preferencia sin limitar ni garantizar pedidos | `RouteMatch.affectsOrderAssignment: false` y `simulated: true`; las proyecciones disponibles incluyen la aclaración en `assumptions`. Consultar no cambia conexión, entregas ni perfil de ubicación. | Mostrar la aclaración también en la exploración y antes de calcular, usando los indicadores acordados. |

## Revisión y cambios

Antes, `exploreRoute` devolvía únicamente los extremos del catálogo. Se incorporan datos internos en `src/data/mentorRoutes.ts` y una regla pura en `src/domain/mentorRoutes.ts`, reutilizada por el adaptador local. No se crean otros servicios ni catálogos de etiquetas.

Los corredores de demostración son Lima Centro → Jesús María → Miraflores → Surco y San Miguel → Jesús María → Miraflores. Se pueden consultar en ambos sentidos. Solo sus extremos identifican cada escenario; otros pares distintos devuelven lista vacía. Las consultas con origen igual a destino usan las relaciones cercanas del archivo de datos. Esta convención debe usarse igual en el servicio simulado del compañero.

Las asociaciones son ficticias: no representan distancia, caminos reales, tráfico, tiempos de traslado, cobertura ni pedidos asignados. No se calculan trayectos entre coordenadas. Los resultados son copias independientes, sin duplicados y con las etiquetas del catálogo existente.

La exploración no guarda origen/destino, no registra eventos ni aumenta revisiones. La zona elegida se guarda solamente como parte de una configuración completa válida; no cambia `Profile.zoneId`. Editar la configuración invalida la proyección anterior, como en A-06. No se guarda una elección incompleta mediante una escritura oculta.

## Acuerdo de integración

**Ningún criterio de A-07 requiere ampliar el contrato.** `RouteMatch.zones` admite varias coincidencias o ninguna. La nota anterior de motor que proponía publicar `neighborZoneIds` se sustituye: las relaciones pueden permanecer internas al motor. No se modifica `docs/integracion/mentor-contract.ts` ni su copia de producción.

La convención origen igual a destino para explorar alrededor de una zona debe comunicarse al compañero, pero usa las firmas actuales. Si en el futuro se solicita ubicación GPS, distancias o persistir el borrador de origen/destino, eso necesitaría otro acuerdo; no forma parte de esta historia.

## Pruebas relacionadas

```sh
node --test tests/mentorRoutes.test.mjs tests/mentorConfiguration.test.mjs tests/mentor.local.test.mjs tests/mentor-contract-source.test.mjs tests/program.test.mjs
node node_modules/typescript/bin/tsc -b
```

Se comprueban cercanía, corredores y reversos, catálogo canónico, copias independientes, consultas inválidas, coincidencias ausentes, ausencia de efectos, selección manual, traslado al cálculo, recarga, aislamiento entre perfiles y reintentos sin duplicar escrituras. La suite reutilizable de contrato comprueba indicadores, catálogo y ausencia de duplicados sin imponer los datos específicos de estos escenarios a otros adaptadores.
