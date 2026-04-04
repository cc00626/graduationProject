# MapLibre POC（独立试验方案）

## 1. 目标
- 验证 MapLibre 在监控大屏中的视觉表现（矢量瓦片、平滑缩放、图层样式）。
- 不破坏现有 OpenLayers 页面，先并行做 POC。

## 2. 安装
```bash
npm i maplibre-gl
```

## 3. 最小组件示例
```tsx
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MapLibrePoc = () => {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return

    const map = new maplibregl.Map({
      container: ref.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [113.2644, 23.1291],
      zoom: 8.8,
      pitch: 25,
      antialias: true,
    })

    map.on('load', () => {
      map.addSource('district-risk', {
        type: 'geojson',
        data: '/广州市.geojson',
      })

      map.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'district-risk',
        paint: {
          'fill-color': [
            'match',
            ['get', 'riskLevel'],
            3,
            '#22c55e',
            2,
            '#14b8a6',
            '#2b6cb0',
          ],
          'fill-opacity': 0.75,
        },
      })

      map.addLayer({
        id: 'district-line',
        type: 'line',
        source: 'district-risk',
        paint: {
          'line-color': '#9de8ff',
          'line-width': 1.4,
        },
      })
    })

    return () => map.remove()
  }, [])

  return <div style={{ width: '100%', height: '100%' }} ref={ref} />
}

export default MapLibrePoc
```

## 4. 风险与建议
- MapLibre 更依赖“可用底图/瓦片服务”，上线前需确定瓦片源 SLA。
- 若你要快速上线，当前项目优先使用 OpenLayers；MapLibre 作为下一阶段视觉升级。
- 建议通过环境变量切换地图内核，例如：`VITE_MAP_ENGINE=ol|maplibre`。

## 5. POC 验收标准
- 支持桌面和移动端手势（缩放、拖拽、旋转可控）。
- 区县图层与告警点图层独立开关。
- 30fps 以上平滑缩放（测试样本 >= 1000 点）。
