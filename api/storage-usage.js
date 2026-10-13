import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (![R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, supabaseUrl, supabaseKey].every(Boolean))
    return res.status(503).json({ error: 'Configuration du stockage incomplète' })
  const token = (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1]
  if (!token) return res.status(401).json({ error: 'Authentification requise' })
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Session invalide' })
    const familyId = req.query.familyId
    if (typeof familyId !== 'string' || !/^[a-f0-9-]{36}$/i.test(familyId))
      return res.status(400).json({ error: 'Famille invalide' })
    const { data: member, error: memberError } = await supabase.from('family_members')
      .select('id').eq('family_id', familyId).eq('user_id', user.id)
      .eq('is_active', true).eq('role', 'admin').maybeSingle()
    if (memberError || !member) return res.status(403).json({ error: 'Accès administrateur requis' })
    const client = new S3Client({
      region: 'auto', endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
    let bytes = 0, count = 0, continuationToken
    do {
      const page = await client.send(new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME, Prefix: `${familyId}/`, ContinuationToken: continuationToken,
      }))
      for (const object of page.Contents || []) { bytes += object.Size || 0; count++ }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (continuationToken)
    return res.status(200).json({ bytes, count })
  } catch (error) {
    console.error('Erreur métriques R2', error)
    return res.status(500).json({ error: 'Impossible de mesurer le stockage R2' })
  }
}
