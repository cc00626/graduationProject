import request from '@/services/request'

type ApiResponse<T> = {
  data: T
}

export const getWindData = async () => {
  try {
    const response = (await request.get('/wind-data')) as ApiResponse<unknown>
    return response
  } catch (error) {
    console.error('获取风场数据失败:', error)
    return null
  }
}

export const getTyphoonPath = async (no: string) => {
  try {
    const response = (await request.get(`/typhoon/path/${no}`)) as ApiResponse<unknown>
    return response.data
  } catch (error) {
    console.error('获取台风路径失败:', error)
    return null
  }
}

export const getTyphoonList = async () => {
  try {
    const response = (await request.get('/typhoon/list')) as ApiResponse<unknown>
    return response
  } catch (error) {
    console.error('获取台风列表失败:', error)
    return null
  }
}
