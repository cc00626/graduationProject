const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultDistrict: '全市',
  warningLevel: 'all',
  refreshInterval: 5,
  enabledLayers: ['rain', 'wind', 'warning'],
  autoOpenWarningPanel: true,
}

export type AuthUser = {
  id: string
  account: string
  role?: UserRole
  permissions?: string[]
  avatar?: string
  preferences?: UserPreferences
}

export type UserRole = string

export type UserPreferences = {
  defaultDistrict: string
  warningLevel: 'all' | 'medium' | 'high'
  refreshInterval: number
  enabledLayers: string[]
  autoOpenWarningPanel: boolean
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  user: '用户',
}

const ROLE_RANK: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  super_admin: 3,
}

const getRoleRank = (role: UserRole) => ROLE_RANK[role] ?? ROLE_RANK.user

export const getUserRole = (user: AuthUser | null = getAuthUser()): UserRole => {
  if (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'user') {
    return user.role
  }

  return user?.account === 'admin' ? 'super_admin' : 'user'
}

export const hasRole = (minimumRole: UserRole, user: AuthUser | null = getAuthUser()) => {
  return getRoleRank(getUserRole(user)) >= getRoleRank(minimumRole)
}

export const hasPermission = (permission: string, user: AuthUser | null = getAuthUser()) => {
  if (getUserRole(user) === 'super_admin') return true
  return Boolean(user?.permissions?.includes(permission))
}

export const canManageWarnings = (user: AuthUser | null = getAuthUser()) =>
  hasPermission('button:warning:create', user) ||
  hasPermission('button:warning:update', user) ||
  hasPermission('button:warning:publish', user)

export const canManageRoles = (user: AuthUser | null = getAuthUser()) =>
  hasPermission('role:manage', user)

export const canManagePermissions = (user: AuthUser | null = getAuthUser()) =>
  hasPermission('permission:manage', user)

export const getDefaultRoute = (user: AuthUser | null = getAuthUser()) => {
  const candidates = [
    ['page:monitor:rain', '/monitor/rain'],
    ['page:monitor:typhoon', '/monitor/typhoon'],
    ['page:monitor:warning-list', '/monitor/warning-list'],
    ['page:monitor:warning', '/monitor/warning'],
    ['page:setting', '/setting'],
    ['page:permission', '/permission'],
    ['page:role', '/role'],
  ] as const

  return candidates.find(([permission]) => hasPermission(permission, user))?.[1] || '/login'
}

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const getAuthUser = (): AuthUser | null => {
  const user = localStorage.getItem(USER_KEY)
  if (!user) {
    return null
  }

  try {
    return JSON.parse(user) as AuthUser
  } catch {
    clearAuth()
    return null
  }
}

export const getUserPreferences = (): UserPreferences => ({
  ...DEFAULT_USER_PREFERENCES,
  ...(getAuthUser()?.preferences || {}),
})

export const isAuthenticated = () => Boolean(getToken())

export const saveAuth = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const saveAuthUser = (user: AuthUser) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
