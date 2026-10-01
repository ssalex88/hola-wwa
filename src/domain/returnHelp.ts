export type ReturnNeed = 'savings' | 'time' | 'payment-order' | 'personal-vehicle' | 'other' | 'skipped'

export interface NeedAction {
  title: string
  detail: string
  action: 'compare' | 'incentives' | 'adjust-time' | 'save' | 'support' | 'schedule' | 'continue'
}

/** Explicit recommendations keep pilot behavior predictable and explainable. */
export function getNeedActions(need: ReturnNeed): NeedAction[] {
  switch (need) {
    case 'savings': return [
      { title: 'Compara otra zona, franja o duración', detail: 'Los rangos cambian según tus opciones.', action: 'compare' },
      { title: 'Consulta los incentivos de esta opción', detail: 'Se muestran aparte y solo si hay información disponible.', action: 'incentives' },
    ]
    case 'time': return [
      { title: 'Ajusta el tiempo disponible', detail: 'Cambia la duración y se actualiza la estimación.', action: 'adjust-time' },
      { title: 'Guarda esta opción', detail: 'Queda guardada en este perfil para revisarla luego.', action: 'save' },
    ]
    case 'payment-order': return [
      { title: 'Revisa la ruta de ayuda', detail: 'Busca orientación en la sección Ayuda de Soy Rappi.', action: 'support' },
    ]
    case 'personal-vehicle': return [
      { title: 'Sal cuando te convenga o pide un recordatorio', detail: 'Solo si lo pides, guarda esta opción y elige fecha y hora para revisarla.', action: 'schedule' },
    ]
    case 'other':
    case 'skipped': return [
      { title: 'Continúa con tu opción', detail: 'Puedes seguir con la propuesta o volver a las opciones cuando quieras.', action: 'continue' },
    ]
  }
}
