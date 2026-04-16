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
      url: '/station.geojson', // 确保文件在 public 目录下
      format: geoJsonFormat,
    }),
    // 内部定义样式逻辑，确保能读取到 GeoJSON 的 properties
    style: feature => {
      // ⚠️ 注意：这里的 'wind' 和 'name' 必须匹配 stations.geojson 里的字段名
      const wind = feature.get('wind') || 0
      const name = feature.get('name') || ''

      let color = 'rgba(24, 144, 255, 0.9)' // 默认蓝色
      if (wind >= 17.2) color = 'rgba(255, 153, 0, 0.9)' // 橙色
      if (wind >= 24.5) color = 'rgba(255, 0, 0, 0.9)' // 红色

      return new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
        text: new Text({
          text: name,
          offsetY: -15,
          font: 'bold 12px "Microsoft YaHei", sans-serif',
          fill: new Fill({ color: '#fff' }),
          stroke: new Stroke({ color: 'rgba(0,0,0,0.8)', width: 3 }),
        }),
      })
    },
    visible: true,
  })

  layer.set('id', LAYERS.STATION)
  layer.setZIndex(25) // 确保在行政区(10)和水系(6)之上
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
