// 建议将 API Key 放在环境变量中，不要直接硬编码
const AMAP_KEY = '089c43faeb7ee3a6808108f0b3d5215e'

/**
 * 周边搜索函数
 * @param {string} location 中心点坐标 "经度,纬度"
 * @param {string} types POI类型，多个用 | 分隔
 * @param {number} radius 搜索半径（米）
 */
async function searchNearbyResources(location: any, types = '141200', radius = 5000) {
  const url = `https://restapi.amap.com/v5/place/around`

  // 构造请求参数
  const params = new URLSearchParams({
    key: AMAP_KEY,
    location: location, // 必须是 "113.26,23.13" 这种格式
    types: types, // 例如：141200(医疗保健), 150500(地铁站)
    radius: radius,
    page_size: 10, // 每页显示多少条数据
    output: 'json',
  })

  try {
    const response = await fetch(`${url}?${params.toString()}`)
    const data = await response.json()

    if (data.status === '1') {
      return data.pois // 返回 POI 列表数组
    } else {
      console.error('搜索失败:', data.info)
      return []
    }
  } catch (error) {
    console.error('请求异常:', error)
    return []
  }
}
