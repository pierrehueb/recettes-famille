import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const createConfiguredClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) return null

  const client = createClient(supabaseUrl, supabaseAnonKey)
  const pendingMediaUploads = new Set()

  const originalStorageFrom = client.storage.from.bind(client.storage)
  client.storage.from = bucket => {
    const bucketApi = originalStorageFrom(bucket)
    if (bucket !== 'family-media') return bucketApi

    const originalUpload = bucketApi.upload.bind(bucketApi)
    bucketApi.upload = async (path, ...args) => {
      const result = await originalUpload(path, ...args)
      if (!result.error) pendingMediaUploads.add(path)
      return result
    }

    return bucketApi
  }

  const originalFrom = client.from.bind(client)
  client.from = table => {
    const query = originalFrom(table)
    if (table !== 'media') return query

    const originalInsert = query.insert.bind(query)
    query.insert = async (values, ...args) => {
      const result = await originalInsert(values, ...args)
      const rows = Array.isArray(values) ? values : [values]
      const paths = rows.map(row => row?.storage_path).filter(path => pendingMediaUploads.has(path))

      if (result.error) {
        if (paths.length) {
          await client.storage.from('family-media').remove(paths)
          paths.forEach(path => pendingMediaUploads.delete(path))
        }
      } else {
        paths.forEach(path => pendingMediaUploads.delete(path))
      }

      return result
    }

    return query
  }

  return client
}

export const supabase = createConfiguredClient()
