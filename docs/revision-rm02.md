# RM-02 — Perfiles y datos de demostración

## Revisión de lo existente

El proyecto ya tenía seis perfiles, estado por persona en `sessionStorage`, reinicios separados y una referencia temporal fija por pestaña. Faltaban la interrupción de diez días, la pausa declarada y el almacenamiento explícito de metas. La etiqueta del selector se corregía solo para el perfil seleccionado después de simular una entrega.

## Criterios de aceptación

| Criterio | Implementación |
| --- | --- |
| Ocho escenarios | Lucía activa; Andrés 10 días; Camila 20; Marco 45; Carlos 75; Elena pausa declarada con 28 días; Diego sin entregas; Valeria bloqueada. |
| Vehículo, zona, historial y cuenta | Datos ficticios en `demoProfiles.ts`; ficha e historial completo ordenado del más reciente al más antiguo en los controles. |
| Preferencias, metas y progreso por perfil | `ProfileDemoData` conserva cada persona por identificador. Metas opcionales de texto libre editables solo en los controles; máximo ocho de 200 caracteres. |
| Fecha consistente y Lima | Todos los historiales iniciales se generan respecto a `DEMO_REFERENCE_DATE`, fijada por sesión. Fechas presentadas en `America/Lima` y referencia visible en los controles. |

La pausa declarada es una manifestación explícita del perfil ficticio, distinta del estado de cuenta. Elena cumple las condiciones de elegibilidad, pero inicia con invitaciones desactivadas y puede entrar voluntariamente. La duración de una pausa no inventa su motivo. El caso de diez días no cumple el umbral de quince.

Las metas se implementan como objetivos personales de texto libre ante la falta de una definición monetaria. No alteran estimaciones, incentivos ni elegibilidad. Una versión anterior sin metas se carga con una lista vacía.

## Cómo demostrarlo

1. Abre **Controles de demo**, elige Andrés y comprueba que no recibe la propuesta.
2. Elige Camila: tiene 20 días y puede calcular. En **Metas del perfil**, guarda un objetivo.
3. Cambia a Marco, guarda otra meta y configura tres horas. Regresa a Camila: conserva sus metas y elecciones.
4. Elige Elena: la ficha explica su pausa declarada y el acceso voluntario, sin invitación inicial.
5. Simula una entrega completada para Camila: su etiqueta indica actividad reciente. Reinicia solo ese perfil para repetirlo; Marco conserva sus datos.

Recargar la URL principal restaura todos los casos, como exige la demo repetible. Recargar una ruta del programa mantiene la sesión. No se modificó ese comportamiento ni la base visual de Soy Rappi.

## Verificación

- Pruebas de dominio y almacenamiento: fechas relativas incluso en 2030, hora de Lima en cambio de día, elegibilidad, etiquetas posteriores a entregas, aislamiento y reinicio de metas.
- Navegador: ocho perfiles, pausa declarada, metas, preferencias y opciones independientes; recarga del programa; reinicio individual y completo; anchos 360, 390 y escritorio.
- La suite completa también verifica los recorridos existentes: invitación, estimaciones, comparación, ayuda, recordatorios, conexión voluntaria, retorno por entrega y Operaciones.

Resultado de esta entrega: 59 pruebas de reglas y almacenamiento, 14 escenarios de navegador local y compilación correctos. Publicado en `https://vuelve-a-tu-ritmo.vercel.app`; seis recorridos de publicación ejecutados contra esa URL pasaron, incluido el de los ocho perfiles y las metas independientes. No se ejecutó toda la suite de navegador sobre Vercel.

Los datos siguen siendo simulados. Quedan pendientes las integraciones y la validación con repartidores para un piloto real.
