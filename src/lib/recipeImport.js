const numericOrEmpty = value => {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  return Number.isFinite(number) ? number : ''
}

const textOrEmpty = value => typeof value === 'string' ? value.trim() : ''

export function normalizeImportedRecipe(value) {
  if (!value || typeof value !== 'object') throw new Error('Réponse d’analyse invalide.')

  const ingredients = Array.isArray(value.ingredients)
    ? value.ingredients.map(item => ({
        quantity: numericOrEmpty(item?.quantity),
        unit: textOrEmpty(item?.unit),
        name: textOrEmpty(item?.name),
        notes: textOrEmpty(item?.notes),
      })).filter(item => item.name)
    : []

  const steps = Array.isArray(value.steps)
    ? value.steps.map(item => ({
        instruction: textOrEmpty(item?.instruction),
        duration_minutes: numericOrEmpty(item?.duration_minutes),
        temperature_celsius: numericOrEmpty(item?.temperature_celsius),
      })).filter(item => item.instruction)
    : []

  return {
    title: textOrEmpty(value.title),
    description: textOrEmpty(value.description),
    original_author: textOrEmpty(value.original_author),
    origin_year: numericOrEmpty(value.origin_year),
    difficulty: ['facile', 'moyenne', 'difficile'].includes(value.difficulty) ? value.difficulty : '',
    servings: numericOrEmpty(value.servings),
    preparation_time_minutes: numericOrEmpty(value.preparation_time_minutes),
    cooking_time_minutes: numericOrEmpty(value.cooking_time_minutes),
    ingredients,
    steps,
  }
}

export async function analyzeRecipeScan(file) {
  if (!file) throw new Error('Sélectionnez une image de recette.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Utilisez une image JPG, PNG ou WebP.')
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('L’image ne doit pas dépasser 10 Mo.')

  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Impossible de lire l’image.'))
    reader.readAsDataURL(file)
  })

  const response = await fetch('/api/analyze-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'Impossible d’analyser cette recette.')
  return normalizeImportedRecipe(payload?.recipe)
}
