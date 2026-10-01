import type { SupportData } from '../domain/support.ts'

export function createDemoSupportData(profileId: string): SupportData {
  return {
    cases: profileId === 'no-deliveries' ? [] : [
      { id: `DEMO-${profileId}-PAGO-01`, kind: 'payment', description: 'No aparece el pago de una entrega en el resumen simulado.', status: 'pending' },
      { id: `DEMO-${profileId}-PEDIDO-02`, kind: 'order', description: 'Una cancelación de pedido figura pendiente de revisión en el historial simulado.', status: 'in-review' },
    ],
    selectedCaseId: null,
    requests: {},
  }
}
