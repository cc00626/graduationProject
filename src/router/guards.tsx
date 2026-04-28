import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { getDefaultRoute, hasPermission, isAuthenticated } from '@/utils/auth'

export const ProtectedRoute = ({ children }: { children: ReactElement }) => {
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
  if (!hasPermission(permission)) {
    return <Navigate to={getDefaultRoute()} replace />
  }
  return children
}
