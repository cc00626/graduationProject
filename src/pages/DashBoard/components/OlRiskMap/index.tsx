import { useEffect, useMemo, useRef, useState } from 'react'
import 'ol/ol.css'
import Map from 'ol/Map'
import type MapBrowserEvent from 'ol/MapBrowserEvent'
import View from 'ol/View'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { defaults as defaultControls } from 'ol/control'
import { defaults as defaultInteractions } from 'ol/interaction'
import { Fill, Stroke, Style, Text as TextStyle, Circle as CircleStyle } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import style from './index.module.scss'

type RiskLevel = 1 | 2 | 3

type MarkerPoint = {
  name: string
  coord: [number, number]
  value: number
}

type Props = {
  riskByDistrict: Record<string, RiskLevel>
  markers: MarkerPoint[]
  className?: string
}

const riskFillMap: Record<RiskLevel, string> = {
  1: 'rgba(37, 112, 192, 0.74)',
  2: 'rgba(39, 182, 176, 0.75)',
  3: 'rgba(44, 208, 133, 0.82)',
}

const strokeColor = 'rgba(138, 224, 255, 0.92)'

const makeDistrictStyle = (name: string, risk: RiskLevel, isFocused: boolean) =>
  new Style({
    fill: new Fill({ color: riskFillMap[risk] }),
    stroke: new Stroke({
      color: isFocused ? '#e6fbff' : strokeColor,
      width: isFocused ? 2.6 : 1.3,
    }),
    text: new TextStyle({
      text: name,
      font: '12px "Microsoft YaHei", sans-serif',
      fill: new Fill({ color: '#d8f7ff' }),
      stroke: new Stroke({ color: 'rgba(2, 24, 51, 0.9)', width: 2.6 }),
      overflow: true,
    }),
    zIndex: isFocused ? 9 : 2,
  })

const makeMarkerStyle = (value: number) =>
  new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: 'rgba(120, 244, 255, 0.95)' }),
      stroke: new Stroke({ color: '#ffffff', width: 1.2 }),
    }),
    text: new TextStyle({
      text: String(value),
      offsetY: -18,
      font: '700 11px Rajdhani, "Microsoft YaHei", sans-serif',
      padding: [3, 6, 3, 6],
      fill: new Fill({ color: '#d9f6ff' }),
      backgroundFill: new Fill({ color: 'rgba(12, 86, 178, 0.86)' }),
      backgroundStroke: new Stroke({ color: 'rgba(122, 216, 255, 0.85)', width: 1 }),
    }),
    zIndex: 12,
  })

const OlRiskMap = ({ riskByDistrict, markers, className }: Props) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const districtLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const focusedNameRef = useRef<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const markerFeatures = useMemo(
    () =>
      markers.map(item => {
        const feature = new Feature({ geometry: new Point(fromLonLat(item.coord)) })
        feature.set('featureType', 'marker')
        feature.set('value', item.value)
        feature.set('name', item.name)
        return feature
      }),
    [markers],
  )

  useEffect(() => {
    const target = wrapperRef.current
    if (!target) return

    const districtSource = new VectorSource({
      url: '/广州市.geojson',
      format: new GeoJSON(),
    })

    const districtLayer = new VectorLayer({
      source: districtSource,
      style: feature => {
        const rawName = feature.get('name')
        const name = typeof rawName === 'string' ? rawName : '未知区域'
        const risk = riskByDistrict[name] ?? 1
        return makeDistrictStyle(name, risk, focusedNameRef.current === name)
      },
    })
    districtLayerRef.current = districtLayer

    const markerLayer = new VectorLayer({
      source: new VectorSource({ features: markerFeatures }),
      style: feature => makeMarkerStyle((feature.get('value') as number) || 0),
    })

    const map = new Map({
      target,
      layers: [districtLayer, markerLayer],
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false }),
      view: new View({
        center: fromLonLat([113.2644, 23.1291]),
        zoom: 9,
        minZoom: 8,
        maxZoom: 13,
      }),
    })
    mapRef.current = map

    districtSource.once('change', () => {
      if (districtSource.getState() !== 'ready') return
      const extent = districtSource.getExtent()
      map.getView().fit(extent, {
        padding: [18, 18, 18, 18],
        duration: 500,
        maxZoom: 11,
      })
      setIsLoading(false)
    })

    const handlePointerMove = (evt: MapBrowserEvent<PointerEvent>) => {
      const hit = map.forEachFeatureAtPixel(evt.pixel, feature => feature)
      const nextName = hit && hit.get('featureType') !== 'marker' ? (hit.get('name') as string) : null

      if (nextName !== focusedNameRef.current) {
        focusedNameRef.current = nextName
        districtLayer.changed()
      }

      map.getTargetElement().style.cursor = nextName ? 'pointer' : 'default'
    }

    map.on('pointermove' as any, handlePointerMove as any)

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize()
    })
    resizeObserver.observe(target)

    return () => {
      resizeObserver.disconnect()
      map.un('pointermove' as any, handlePointerMove as any)
      map.setTarget(undefined)
      mapRef.current = null
      districtLayerRef.current = null
    }
  }, [markerFeatures, riskByDistrict])

  return (
    <div className={`${style.mapHost} ${className || ''}`}>
      <div ref={wrapperRef} className={style.mapCanvas}></div>
      {isLoading && <div className={style.mapLoading}>地图数据加载中...</div>}
    </div>
  )
}

export default OlRiskMap
