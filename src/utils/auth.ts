const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export type AuthUser = {
  id: string
  account: string
}

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const isAuthenticated = () => Boolean(getToken())

export const saveAuth = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

