import { Feature } from 'ol'
import { Circle as CircleGeometry, Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj'
import { Fill, Stroke, Style, Text } from 'ol/style'
import CircleStyle from 'ol/style/Circle'
import type { WarningLevel, WarningRecord } from '@/services/warning'

const levelStyleMap: Record<
  WarningLevel,
  { color: string; fill: string; label: string }
> = {
  low: {
    color: '#52c41a',
    fill: 'rgba(82, 196, 26, 0.14)',
    label: '低',
  },
  medium: {
    color: '#fa8c16',
    fill: 'rgba(250, 140, 22, 0.16)',
    label: '中',
  },
  high: {
    color: '#ff4d4f',
    fill: 'rgba(255, 77, 79, 0.18)',
    label: '高',
  },
}

const hasValidCenter = (warning: WarningRecord) =>
  Array.isArray(warning.center) &&
  warning.center.length === 2 &&
  warning.center.every(item => Number.isFinite(Number(item)))

export const getWarningPointStyle = (level: WarningLevel) => {
  const config = levelStyleMap[level]

  return new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({ color: config.color }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
    text: new Text({
      text: config.label,
      fill: new Fill({ color: '#fff' }),
      font: 'bold 12px sans-serif',
      offsetY: 0,
    }),
  })
}

export const getWarningAreaStyle = (level: WarningLevel) => {
  const config = levelStyleMap[level]

  return new Style({
    fill: new Fill({
      color: config.fill,
    }),
    stroke: new Stroke({
      color: config.color,
      width: 2,
      lineDash: [8, 5],
    }),
  })
}

export const createWarningFeatures = (warnings: WarningRecord[]) => {
  const features: Feature[] = []

  warnings.filter(hasValidCenter).forEach(warning => {
    const center = fromLonLat([Number(warning.center?.[0]), Number(warning.center?.[1])])
    const radiusInMeters = Math.max(Number(warning.radius || 0), 0.5) * 1000

    const areaFeature = new Feature({
      geometry: new CircleGeometry(center, radiusInMeters),
      warning,
      warningRole: 'area',
    })
    areaFeature.setStyle(getWarningAreaStyle(warning.level))

    const pointFeature = new Feature({
      geometry: new Point(center),
      warning,
      warningRole: 'point',
    })
    pointFeature.setStyle(getWarningPointStyle(warning.level))

    features.push(areaFeature, pointFeature)
  })

  return features
}

export const getWarningPopupHtml = (warning: WarningRecord) => {
  const levelText =
    warning.level === 'high' ? '高风险' : warning.level === 'medium' ? '中风险' : '低风险'
  const typeText =
    warning.type === 'typhoon' ? '台风' : warning.type === 'rain' ? '暴雨' : '洪涝'
  const time = warning.publishedAt || warning.createdAt
  const timeText = time ? new Date(time).toLocaleString() : '-'

  return `
    <div style="font-weight: 600; margin-bottom: 6px;">${warning.title}</div>
    <div>类型：${typeText}</div>
    <div>等级：${levelText}</div>
    <div>范围：${warning.radius || 0} km</div>
    <div>时间：${timeText}</div>
    <div style="margin-top: 6px; max-width: 260px; white-space: normal;">${warning.description || '-'}</div>
  `
}
