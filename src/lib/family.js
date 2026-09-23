import { supabase } from './supabase'

export const ACTIVE_FAMILY_KEY = 'recettes-famille-active-family'

export async function getFamilyMemberships(userId) {
  if (!supabase || !userId) throw new Error('Utilisateur non connecté.')

  const { data: memberships, error } = await supabase
    .from('family_members')
    .select('id, family_id, role, display_name, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!memberships?.length) return []

  const familyIds = [...new Set(memberships.map(item => item.family_id))]
  const { data: families, error: familiesError } = await supabase
    .from('families')
    .select('id, name, description')
    .in('id', familyIds)

  if (familiesError) throw familiesError
  const familyById = new Map((families ?? []).map(family => [family.id, family]))
  return memberships.map(item => ({ ...item, families: familyById.get(item.family_id) ?? null }))
}

export async function getCurrentFamilyMembership(userId, preferredFamilyId = null) {
  const memberships = await getFamilyMemberships(userId)
  if (!memberships.length) throw new Error('Aucune famille active trouvée.')

  const storedFamilyId = preferredFamilyId || window.localStorage.getItem(ACTIVE_FAMILY_KEY)
  const current = memberships.find(item => item.family_id === storedFamilyId) || memberships[0]
  window.localStorage.setItem(ACTIVE_FAMILY_KEY, current.family_id)
  return current
}
