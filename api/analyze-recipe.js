const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    original_author: { type: 'string' },
    origin_year: { type: ['integer', 'null'] },
    difficulty: { type: ['string', 'null'], enum: ['facile', 'moyenne', 'difficile', null] },
    servings: { type: ['number', 'null'] },
    preparation_time_minutes: { type: ['number', 'null'] },
    cooking_time_minutes: { type: ['number', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          quantity: { type: ['number', 'null'] },
          unit: { type: 'string' },
          name: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['quantity', 'unit', 'name', 'notes'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          instruction: { type: 'string' },
          duration_minutes: { type: ['number', 'null'] },
          temperature_celsius: { type: ['number', 'null'] },
        },
        required: ['instruction', 'duration_minutes', 'temperature_celsius'],
      },
    },
  },
  required: ['title', 'description', 'original_author', 'origin_year', 'difficulty', 'servings', 'preparation_time_minutes', 'cooking_time_minutes', 'ingredients', 'steps'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'L’analyse de recette n’est pas encore configurée.' })

  const image = req.body?.image
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return res.status(400).json({ error: 'Image invalide.' })
  }
  const base64 = image.slice(image.indexOf(',') + 1)
  if (Math.ceil(base64.length * 3 / 4) > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Image trop volumineuse.' })

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extrais fidèlement cette recette imprimée. N’invente aucune information absente. Utilise une chaîne vide ou null selon le schéma lorsqu’une donnée n’est pas visible. Convertis les durées en minutes. Sépare les ingrédients et les étapes dans leur ordre d’origine. La difficulté ne doit être renseignée que si elle est explicitement indiquée.' },
            { type: 'input_image', image_url: image, detail: 'high' },
          ],
        }],
        text: { format: { type: 'json_schema', name: 'recipe_scan', strict: true, schema } },
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data?.error?.message || 'Erreur du service d’analyse.')
    const output = data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text
    if (!output) throw new Error('Aucune recette n’a été extraite.')
    return res.status(200).json({ recipe: JSON.parse(output) })
  } catch (error) {
    console.error('Recipe scan analysis failed:', error)
    return res.status(500).json({ error: 'Impossible d’analyser cette recette pour le moment.' })
  }
}
