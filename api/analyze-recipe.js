const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const usage = new Map()
const MAX_REQUESTS_PER_HOUR = 10

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
          quantity: { type: 'string' },
          unit: { type: 'string' },
          name: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['quantity', 'unit', 'name', 'notes'],
      },
    },
    illustration: {
      type: 'object', additionalProperties: false,
      properties: {
        found: { type: 'boolean' },
        x: { type: 'integer' }, y: { type: 'integer' },
        width: { type: 'integer' }, height: { type: 'integer' },
      },
      required: ['found', 'x', 'y', 'width', 'height'],
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
  required: ['title', 'description', 'original_author', 'origin_year', 'difficulty', 'servings', 'preparation_time_minutes', 'cooking_time_minutes', 'ingredients', 'steps', 'illustration'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'L’analyse de recette n’est pas encore configurée.' })

  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1]
  const familyId = req.body?.familyId
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!token) return res.status(401).json({ error: 'Connectez-vous pour analyser une recette.' })
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'Authentification serveur non configurée.' })
  if (typeof familyId !== 'string' || !/^[0-9a-f-]{36}$/i.test(familyId)) {
    return res.status(400).json({ error: 'Famille invalide.' })
  }

  // Verify the JWT with Supabase Auth, then check the user's active family role via RLS.
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}` }
  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers })
    if (!authResponse.ok) return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' })
    const authenticatedUser = await authResponse.json()
    if (!authenticatedUser.id || authenticatedUser.is_anonymous) {
      return res.status(403).json({ error: 'Compte non autorisé.' })
    }
    const membershipUrl = new URL(`${supabaseUrl}/rest/v1/family_members`)
    membershipUrl.searchParams.set('select', 'role')
    membershipUrl.searchParams.set('user_id', `eq.${authenticatedUser.id}`)
    membershipUrl.searchParams.set('family_id', `eq.${familyId}`)
    membershipUrl.searchParams.set('is_active', 'eq.true')
    membershipUrl.searchParams.set('role', 'in.(admin,editor)')
    const membershipResponse = await fetch(membershipUrl, { headers })
    if (!membershipResponse.ok) throw new Error('Membership verification failed')
    const memberships = await membershipResponse.json()
    if (!Array.isArray(memberships) || memberships.length === 0) {
      return res.status(403).json({ error: 'Vous ne pouvez pas importer de recettes dans cette famille.' })
    }
    const now = Date.now()
    for (const [key, entry] of usage) if (entry.expiresAt <= now) usage.delete(key)
    const key = authenticatedUser.id
    const entry = usage.get(key)
    if (entry && entry.count >= MAX_REQUESTS_PER_HOUR) {
      return res.status(429).json({ error: 'Limite temporaire atteinte. Réessayez dans une heure.' })
    }
    usage.set(key, entry ? { ...entry, count: entry.count + 1 } : { count: 1, expiresAt: now + 3600000 })
  } catch (error) {
    console.error('Recipe scan authorization failed:', error)
    return res.status(503).json({ error: 'Impossible de vérifier vos droits pour le moment.' })
  }

  const image = req.body?.image
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return res.status(400).json({ error: 'Image invalide.' })
  }
  const base64 = image.slice(image.indexOf(',') + 1)
  if (Math.ceil(base64.length * 3 / 4) > MAX_IMAGE_BYTES) return res.status(413).json({ error: 'Image trop volumineuse. Choisissez une image de moins de 3 Mo.' })

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extrais fidèlement cette recette imprimée. N’invente aucune information absente. Utilise une chaîne vide ou null selon le schéma lorsqu’une donnée n’est pas visible. Conserve les quantités exactement comme imprimées, notamment les fractions (1/4, 1/3, 1 1/2), sans les convertir en décimales. Si la quantité est absente, utilise une chaîne vide. Convertis les durées en minutes. Sépare les ingrédients et les étapes dans leur ordre d’origine. Repère la photo principale du plat (pas les petits pictogrammes). Si elle est clairement présente, fournis son rectangle x, y, width, height en coordonnées normalisées 0 à 1000 relatives à l’image entière; ne recadre pas le texte. Si aucune illustration identifiable, found=false et coordonnées à zéro. La difficulté ne doit être renseignée que si elle est explicitement indiquée.' },
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
