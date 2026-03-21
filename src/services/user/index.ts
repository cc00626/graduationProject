import request from '@/services/request'
export interface UserData {
  account: string
  password: string
}

interface UserInfo {
  id: string
  account: string
}

interface RegisterData {
  token: string
  user: UserInfo
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
//用户注册接口
export const UserRegister = (data: UserData) => {
  // 传入泛型，告诉 TS：返回值的 data 字段符合 RegisterData 结构
  return request.post<ApiResponse<RegisterData>>('/auth/register', data)
}

//用户登录接口
export const UserRLogin = (data: UserData) => {
  return request.post('/auth/login', data)
}
