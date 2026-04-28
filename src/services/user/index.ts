import request from '@/services/request'
import type { AuthUser, UserPreferences, UserRole } from '@/utils/auth'

export interface UserData {
  account: string
  password: string
}

interface AuthData {
  token: string
  user: AuthUser
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface ProfilePayload {
  account: string
  avatar?: string
  preferences: UserPreferences
}

export interface PasswordPayload {
  oldPassword: string
  newPassword: string
}

export interface PermissionItem {
  code: string
  name: string
  type: 'page' | 'button' | string
  group: string
}

export interface RoleItem {
  key: string
  name: string
  description?: string
  rank: number
  builtin: boolean
  permissions: string[]
}

export const UserRegister = (data: UserData) => {
  return request.post<ApiResponse<AuthData>, UserData>('/auth/register', data)
}

export const UserRLogin = (data: UserData) => {
  return request.post<ApiResponse<AuthData>, UserData>('/auth/login', data)
}

export const UserLogout = () => {
  return request.post<ApiResponse<null>>('/auth/logout')
}

export const GetCurrentUser = () => {
  return request.get<ApiResponse<AuthUser>>('/auth/me')
}

export const UpdateProfile = (data: ProfilePayload) => {
  return request.put<ApiResponse<AuthData>, ProfilePayload>('/auth/profile', data)
}

export const UpdatePassword = (data: PasswordPayload) => {
  return request.put<ApiResponse<null>, PasswordPayload>('/auth/password', data)
}

export const GetUsers = () => {
  return request.get<ApiResponse<AuthUser[]>>('/auth/users')
}

export const UpdateUserRole = (id: string, role: UserRole) => {
  return request.patch<ApiResponse<AuthUser>, { role: UserRole }>(`/auth/users/${id}/role`, {
    role,
  })
}

export const GetPermissionCatalog = () => {
  return request.get<ApiResponse<PermissionItem[]>>('/auth/permissions/catalog')
}

export const GetRoles = () => {
  return request.get<ApiResponse<RoleItem[]>>('/auth/roles')
}

export const CreateRole = (data: Pick<RoleItem, 'name'> & Partial<Pick<RoleItem, 'key' | 'description' | 'permissions'>>) => {
  return request.post<ApiResponse<RoleItem>, typeof data>('/auth/roles', data)
}

export const UpdateRole = (key: string, data: Pick<RoleItem, 'name'> & Partial<Pick<RoleItem, 'description'>>) => {
  return request.patch<ApiResponse<RoleItem>, typeof data>(`/auth/roles/${key}`, data)
}

export const UpdateRolePermissions = (key: string, permissions: string[]) => {
  return request.put<ApiResponse<RoleItem>, { permissions: string[] }>(`/auth/roles/${key}/permissions`, {
    permissions,
  })
}

export const DeleteRole = (key: string) => {
  return request.delete<ApiResponse<null>>(`/auth/roles/${key}`)
}
