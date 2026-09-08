import { supabase } from './supabase'

export async function getCurrentFamilyMembership(userId) {
  if (!supabase || !userId) throw new Error('Utilisateur non connecté.')

  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Aucune famille active trouvée.')

  return data
}
