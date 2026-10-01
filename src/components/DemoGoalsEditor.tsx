import { useEffect, useState } from 'react'

export function DemoGoalsEditor({ name, goals, onChange }: { name: string; goals: string[]; onChange: (goals: string[]) => void }) {
  const [draft, setDraft] = useState(goals.join('\n'))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setDraft(goals.join('\n')); setNotice(''); setError('') }, [goals])
  return <form className="demo-goals" onSubmit={event => {
    event.preventDefault()
    const entries = draft.split('\n').map(item => item.trim()).filter(Boolean)
    if (entries.length > 8 || entries.some(item => item.length > 200)) { setError('Usa hasta 8 metas, de 200 caracteres cada una.'); return }
    onChange(entries)
    setError('')
    // The status remains local; the goals themselves belong to the selected profile.
    requestAnimationFrame(() => setNotice(entries.length ? `Metas guardadas para ${name}.` : `Metas eliminadas de ${name}.`))
  }}>
    <label htmlFor="demo-goals">Metas personales de {name} (opcional)</label>
    <p>Escribe una por línea y guarda. Son objetivos de este perfil ficticio; no modifican la estimación ni prometen ingresos.</p>
    <textarea id="demo-goals" value={draft} maxLength={1607} rows={4} aria-describedby="demo-goals-hint" aria-invalid={Boolean(error)} onChange={event => { setDraft(event.target.value); setNotice(''); setError('') }} />
    <small id="demo-goals-hint">Hasta 8 metas. Deja el campo vacío y guarda para eliminarlas.</small>
    {error && <p role="alert">{error}</p>}
    <button type="submit">Guardar metas de este perfil</button>
    {notice && <p role="status">{notice}</p>}
  </form>
}
