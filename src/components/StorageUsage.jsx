import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const formatBytes = bytes => {
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go', 'To']
  let value = bytes
  let unit = -1
  do { value /= 1024; unit++ } while (value >= 1024 && unit < units.length - 1)
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${units[unit]}`
}

// Parcourt tous les sous-dossiers de la famille ; la liste est soumise aux règles RLS Supabase.
async function measureSupabase(familyId) {
  const folders = [familyId]
  let bytes = 0, count = 0
  while (folders.length) {
    const folder = folders.pop()
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from('family-media')
        .list(folder, { limit: 100, offset })
      if (error) throw error
      for (const item of data || []) {
        if (item.id == null) folders.push(`${folder}/${item.name}`)
        else { bytes += Number(item.metadata?.size || 0); count++ }
      }
      if ((data || []).length < 100) break
    }
  }
  return { bytes, count }
}

export default function StorageUsage({ familyId }) {
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!familyId) return
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Session expirée')
      const [r2Response, supabaseResult] = await Promise.all([
        fetch(`/api/storage-usage?familyId=${encodeURIComponent(familyId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        measureSupabase(familyId),
      ])
      const r2Result = await r2Response.json().catch(() => ({}))
      if (!r2Response.ok) throw new Error(r2Result.error || 'Erreur Cloudflare R2')
      setUsage({ r2: r2Result, supabase: supabaseResult })
    } catch (err) { setError(err.message || 'Mesure indisponible') }
    finally { setLoading(false) }
  }, [familyId])
  useEffect(() => { refresh() }, [refresh])
  return <section className="family-card" style={{ marginTop: '1.5rem' }}>
    <div className="family-card-heading">
      <div><h3>Utilisation du stockage</h3><p>Fichiers de cette famille, relevés à la demande.</p></div>
      <button type="button" className="secondary-button small-button" onClick={refresh} disabled={loading}>
        {loading ? 'Calcul…' : '↻ Actualiser'}
      </button>
    </div>
    {error && <p className="form-error">{error}</p>}
    {usage && <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
      <div><strong>Cloudflare R2</strong><p style={{ fontSize: '1.4rem', margin: '.25rem 0' }}>{formatBytes(usage.r2.bytes)}</p><small>{usage.r2.count} fichier(s) originaux</small></div>
      <div><strong>Supabase Storage</strong><p style={{ fontSize: '1.4rem', margin: '.25rem 0' }}>{formatBytes(usage.supabase.bytes)}</p><small>{usage.supabase.count} fichier(s)</small></div>
      <div><strong>Total</strong><p style={{ fontSize: '1.4rem', margin: '.25rem 0' }}>{formatBytes(usage.r2.bytes + usage.supabase.bytes)}</p></div>
    </div>}
    <p style={{ fontSize: '.8rem', opacity: .75, marginTop: '1rem' }}>Mesure des objets de cette famille uniquement, pas des quotas globaux des comptes. Supabase dépend des fichiers visibles par votre session.</p>
  </section>
}
