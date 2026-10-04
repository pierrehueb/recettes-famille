import { supabase } from './supabase'

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
        quantity: item?.quantity == null ? '' : String(item.quantity).trim(),
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

export async function analyzeRecipeScan(file, familyId) {
  if (!supabase) throw new Error('Connexion indisponible.')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) throw new Error('Reconnectez-vous avant d’importer une recette.')
  if (!familyId) throw new Error('Sélectionnez une famille.')
  if (!file) throw new Error('Sélectionnez une image de recette.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Utilisez une image JPG, PNG ou WebP.')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('L’image ne doit pas dépasser 20 Mo.')

  // Downscale phone photos to stay below Vercel's request body limit.
  const optimizedFile = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossible de préparer l’image.')), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')) }
    img.src = url
  })
  if (optimizedFile.size > 3 * 1024 * 1024) throw new Error('Image trop volumineuse après compression.')
  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Impossible de lire l’image.'))
    reader.readAsDataURL(optimizedFile)
  })

  const response = await fetch('/api/analyze-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ image, familyId }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'Impossible d’analyser cette recette.')
  return normalizeImportedRecipe(payload?.recipe)
}
