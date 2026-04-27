import request from '@/services/request'
export type BufferPoiItem = {
  id: string
  name: string
  type: string
  location: string // 格式: "113.264434,23.129163"
  address: string
  distance: string // 距离中心点的距离（米）
  tel: string
}

// 接口响应荷载
export type BufferAnalysisPayload = {
  success: boolean
  count: string
  pois: BufferPoiItem[]
  msg?: string
}

export async function getBufferAnalysis(
  location: string,
  radius: number = 5000,
  disasterType: 'flood' | 'wind' | 'rescue' = 'flood',
) {
  return request.get('/rain/buffer', {
    params: {
      location,
      radius,
      disasterType,
    },
    timeout: 40000,
  }) as Promise<BufferAnalysisPayload>
}
