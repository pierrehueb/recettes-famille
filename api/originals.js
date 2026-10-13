import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@supabase/supabase-js'

const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
const MAX_BYTES = 50 * 1024 * 1024
const send = (res, status, data) => res.status(status).json(data)

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée' })
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, SUPABASE_URL, SUPABASE_ANON_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env
  if (![R2_ACCOUNT_ID,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET_NAME].every(Boolean)) return send(res,503,{error:'Stockage R2 non configuré'})
  const token = (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1]
  if (!token) return send(res,401,{error:'Authentification requise'})
  const supabase = createClient(SUPABASE_URL || VITE_SUPABASE_URL, SUPABASE_ANON_KEY || VITE_SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return send(res,401,{error:'Session invalide'})
  const { action, recipeId, path, mimeType, size } = req.body || {}
  if (!['upload','read','delete'].includes(action) || !/^[a-f0-9-]{36}$/i.test(recipeId || '')) return send(res,400,{error:'Requête invalide'})
  const { data: recipe, error: recipeError } = await supabase.from('recipes').select('id,family_id,created_by').eq('id',recipeId).single()
  if (recipeError || !recipe) return send(res,403,{error:'Recette inaccessible'})
  const { data: membership } = await supabase.from('family_members').select('id,role').eq('family_id',recipe.family_id).eq('user_id',user.id).eq('is_active',true).maybeSingle()
  if (!membership) return send(res,403,{error:'Accès refusé'})
  if (action === 'upload' && membership.role === 'viewer') return send(res,403,{error:'Modification interdite'})
  if (action === 'delete' && membership.role !== 'admin' && membership.id !== recipe.created_by) return send(res,403,{error:'Suppression interdite'})
  const client = new S3Client({ region:'auto',endpoint:`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:R2_ACCESS_KEY_ID,secretAccessKey:R2_SECRET_ACCESS_KEY} })
  let key
  if (action === 'upload') {
    if (!allowedTypes.has(mimeType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) return send(res,400,{error:'Format ou taille non autorisés (50 Mo max)'})
    key = `${recipe.family_id}/originals/${recipeId}/${crypto.randomUUID()}`
    const url = await getSignedUrl(client,new PutObjectCommand({Bucket:R2_BUCKET_NAME,Key:key,ContentType:mimeType}),{expiresIn:300})
    return send(res,200,{url,path:`r2:${key}`})
  }
  if (typeof path !== 'string' || !path.startsWith(`r2:${recipe.family_id}/originals/${recipeId}/`)) return send(res,403,{error:'Chemin non autorisé'})
  const { data: record } = await supabase.from('media').select('id').eq('recipe_id',recipeId).eq('storage_path',path).eq('media_type','scan').maybeSingle()
  if (!record) return send(res,404,{error:'Document introuvable'})
  key = path.slice(3)
  if (action === 'read') {
    const url = await getSignedUrl(client,new GetObjectCommand({Bucket:R2_BUCKET_NAME,Key:key}),{expiresIn:300})
    return send(res,200,{url})
  }
  await client.send(new DeleteObjectCommand({Bucket:R2_BUCKET_NAME,Key:key}))
  return send(res,200,{ok:true})
}
