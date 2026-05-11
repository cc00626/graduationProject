import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { GetCurrentUser } from '@/services/user'
import {
  clearAuth,
  hasPermission,
  isAuthenticated,
  saveAuthUser,
} from '@/utils/auth'

export const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      setReady(true)
      return
    }

    const syncCurrentUser = async () => {
      try {
        const res = await GetCurrentUser()
        if (res.code !== 0) {
          clearAuth()
          return
        }
        saveAuthUser(res.data)
        window.dispatchEvent(new Event('auth-user-updated'))
      } finally {
        setReady(true)
      }
    }

    void syncCurrentUser()
  }, [])

  if (!ready) {
    return null
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return children
}

export const GuestOnlyRoute = ({ children }: { children: ReactElement }) => {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }
  return children
}

export const PermissionRoute = ({
  children,
  permission,
}: {
  children: ReactElement
  permission: string
}) => {
  const location = useLocation()
  const [checked, setChecked] = useState(() => hasPermission(permission))
  const [ready, setReady] = useState(() => hasPermission(permission))

  useEffect(() => {
    if (hasPermission(permission)) {
      setChecked(true)
      setReady(true)
      return
    }

    let mounted = true
    const syncPermission = async () => {
      try {
        const res = await GetCurrentUser()
        if (!mounted) return

        if (res.code !== 0) {
          clearAuth()
          setChecked(false)
          return
        }

        saveAuthUser(res.data)
        window.dispatchEvent(new Event('auth-user-updated'))
        setChecked(hasPermission(permission, res.data))
      } finally {
        if (mounted) {
          setReady(true)
        }
      }
    }

    setReady(false)
    void syncPermission()

    return () => {
      mounted = false
    }
  }, [permission])

  if (!ready) {
    return null
  }

  if (!checked) {
    return (
      <Navigate
        to="/403"
        replace
        state={{ from: location.pathname, permission }}
      />
    )
  }
  return children
}
