import { useCallback, useEffect, useState } from 'react'
import { fetchCurrentUserProfile, type CurrentUserProfile } from '../services/currentUserService'

export function useCurrentUserProfile() {
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      const value = await fetchCurrentUserProfile(forceRefresh)
      if (value) {
        setProfile(value)
      } else {
        setProfile(null)
      }
    } catch (error) {
      console.error('load profile error:', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadProfile = useCallback(async () => {
    await loadProfile(true)
  }, [loadProfile])

  useEffect(() => {
    void loadProfile(false)
  }, [loadProfile])

  return { profile, loading, reloadProfile }
}
