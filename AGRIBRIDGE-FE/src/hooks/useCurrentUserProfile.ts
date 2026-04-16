import { useEffect, useState } from 'react'
import { fetchCurrentUserProfile, type CurrentUserProfile } from '../services/currentUserService'

export function useCurrentUserProfile() {
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        const value = await fetchCurrentUserProfile()
        if (active) {
          setProfile(value)
        }
      } catch {
        if (active) {
          setProfile(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return { profile, loading }
}
