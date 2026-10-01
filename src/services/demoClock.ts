export const REFERENCE_KEY = 'vuelve-a-tu-ritmo:session-reference:v3'

/** A single as-of date keeps mock profiles and eligibility on the same demo timeline. */
function loadReferenceDate(): Date {
  try {
    const saved = sessionStorage.getItem(REFERENCE_KEY)
    if (saved) {
      const timestamp = Date.parse(saved)
      if (Number.isFinite(timestamp)) return new Date(timestamp)
    }
    const reference = new Date()
    sessionStorage.setItem(REFERENCE_KEY, reference.toISOString())
    return reference
  } catch {
    return new Date()
  }
}

export const DEMO_REFERENCE_DATE = loadReferenceDate()
