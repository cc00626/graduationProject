import GeoJSON from 'ol/format/GeoJSON'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style } from 'ol/style'
import { LAYERS } from '@/constant'

const geoJsonFormat = new GeoJSON({
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
})

export const createDistrictLayer = (style: VectorLayer<VectorSource>['getStyle'] extends () => infer T ? T : any) => {
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
