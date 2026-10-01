export function JourneySteps({ step }: { step: 1 | 2 | 3 }) {
  return <ol className="journey-steps" aria-label="Pasos de tu opción">
    {['Tu tiempo y zona', 'Tu estimación', 'Tú decides'].map((label, index) => <li key={label} className={step === index + 1 ? 'current' : step > index + 1 ? 'complete' : ''} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}
  </ol>
}
