import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
})

// 请求拦截器
instance.interceptors.request.use(
  config => {
    // 获取 token（如果需要）
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  },
)

// 响应拦截器
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回响应数据
    return response.data
  },
  error => {
    // 处理错误
    if (error.response) {
      // 服务器响应了错误状态码
      const { status, data } = error.response
      console.error(`Error ${status}:`, data)

      if (status === 401) {
        // 未授权，清除 token 并重定向到登录页
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    } else if (error.request) {
      console.error('No response received:', error.request)
    } else {
      console.error('Request setup error:', error.message)
    }
    return Promise.reject(error)
  },
)

const request = instance

export default request
