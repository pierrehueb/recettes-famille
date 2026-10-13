import { supabase } from './supabase'

async function request(action, recipeId, details = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Veuillez vous reconnecter.')
  const response = await fetch('/api/originals', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,recipeId,...details}) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Erreur de stockage')
  return body
}
export const isR2Original = path => path?.startsWith('r2:')
export const originalUrl = (recipeId,path) => request('read',recipeId,{path}).then(data=>data.url)
export const deleteR2Original = (recipeId,path) => request('delete',recipeId,{path})
export async function uploadR2Original(recipeId,file) {
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '')
  const signed = await request('upload',recipeId,{mimeType,size:file.size})
  const result = await fetch(signed.url,{method:'PUT',headers:{'Content-Type':mimeType},body:file})
  if (!result.ok) throw new Error('Envoi du document vers R2 impossible.')
  return signed.path
}
