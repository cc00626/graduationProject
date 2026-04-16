import GeoJSON from 'ol/format/GeoJSON'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style } from 'ol/style'
import { LAYERS } from '@/constant'
import { Circle, Text } from 'ol/style'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat } from 'ol/proj'
const geoJsonFormat = new GeoJSON({
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
})

//广州市行政地图
export const createDistrictLayer = (
  style: VectorLayer<VectorSource>['getStyle'] extends () => infer T ? T : any,
) => {
  const layer = new VectorLayer({
    source: new VectorSource({
      url: '/广州市.geojson',
      format: geoJsonFormat,
    }),
    style,
    visible: true,
  })

  layer.set('id', LAYERS.DISTRICT)
  layer.setZIndex(10)
  return layer
}

//水系图层
export const createWaterLayer = () => {
  const layer = new VectorLayer({
    source: new VectorSource({
      url: '/water.geojson',
      format: geoJsonFormat,
    }),
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(73, 185, 255, 0.9)',
        width: 1.8,
      }),
      fill: new Fill({
        color: 'rgba(73, 185, 255, 0.12)',
      }),
    }),
    visible: false,
  })

  layer.set('id', LAYERS.WATER)
  layer.setZIndex(6)
  return layer
}

//气象站点图层
export const createStationLayer = () => {
  const layer = new VectorLayer({
    source: new VectorSource({
      url: '/station.geojson',
      format: geoJsonFormat,
    }),
    style: feature => {
      // 1. 提取多维度属性
      const status = feature.get('status') || 'normal'
      const name = feature.get('name') || ''
      const wind = feature.get('wind_speed') || 0
      const rain = feature.get('rainfall') || 0

      // 2. 多维度颜色逻辑：优先遵循状态位，辅助数值判断
      let color = 'rgba(0, 242, 255, 0.8)' // 默认：清爽的青蓝色 (Normal)

      if (status === 'danger' || wind >= 24.5 || rain >= 50) {
        color = 'rgba(255, 77, 79, 0.9)' // 红色：危险 (极高风速或暴雨)
      } else if (status === 'warning' || wind >= 17.2 || rain >= 30) {
        color = 'rgba(250, 173, 20, 0.9)' // 橙色：警告
      }

      // 3. 动态半径：灾害越严重，点越大，视觉冲击力更强
      const radius = status === 'danger' ? 9 : status === 'warning' ? 7 : 5

      return new Style({
        image: new Circle({
          radius: radius,
          fill: new Fill({ color: color }),
          stroke: new Stroke({
            color: status === 'danger' ? '#fff' : 'rgba(255,255,255,0.6)',
            width: status === 'danger' ? 3 : 1.5,
          }),
        }),
        text: new Text({
          // 展示 站点名 + 关键超标数值 (演示利器)
          text: status !== 'normal' ? `${name}\n(${wind}m/s | ${rain}mm)` : name,
          offsetY: -25,
          font: status === 'danger' ? 'bold 13px "Microsoft YaHei"' : '12px "Microsoft YaHei"',
          fill: new Fill({ color: '#fff' }),
          stroke: new Stroke({
            color: status === 'danger' ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.8)',
            width: 3,
          }),
          // 背景标签，增加可读性
          backgroundFill: status === 'danger' ? new Fill({ color: 'rgba(255,0,0,0.3)' }) : null,
          padding: [2, 4, 2, 4],
        }),
      })
    },
    visible: true,
  })

  layer.set('id', LAYERS.STATION)
  layer.setZIndex(25)
  return layer
}
//高亮图层的样式
export const highlightStationStyle = (feature: any) => {
  return new Style({
    image: new Circle({
      radius: 9, // 比普通点大
      fill: new Fill({ color: '#ffcc33' }), // 亮黄色
      stroke: new Stroke({
        color: '#fff',
        width: 3,
        // 可以添加外发光效果的模拟
      }),
    }),
    text: new Text({
      text: feature.get('name'),
      offsetY: -20,
      font: 'bold 14px "Microsoft YaHei", sans-serif',
      fill: new Fill({ color: '#fff' }),
      stroke: new Stroke({ color: '#ff4d4f', width: 4 }), // 红色描边
    }),
    zIndex: 1000, // 确保在最顶层
  })
}
