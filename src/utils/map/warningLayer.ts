import { Feature } from 'ol'
import { Circle as CircleGeometry, Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj'
import { Fill, Icon, Stroke, Style } from 'ol/style'
import type { WarningLevel, WarningRecord, WarningType } from '@/services/warning'

const levelStyleMap: Record<
  WarningLevel,
  { color: string; fill: string; label: string; shadow: string }
> = {
  low: {
    color: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.14)',
    label: '低',
    shadow: 'rgba(21, 128, 61, 0.34)',
  },
  medium: {
    color: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.16)',
    label: '中',
    shadow: 'rgba(180, 83, 9, 0.34)',
  },
  high: {
    color: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.18)',
    label: '高',
    shadow: 'rgba(185, 28, 28, 0.36)',
  },
}

const warningLevelText: Record<WarningLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

const warningTypeText: Record<WarningType, string> = {
  rain: '暴雨',
  flood: '洪涝',
  typhoon: '台风',
}

const hasValidCenter = (warning: WarningRecord) =>
  Array.isArray(warning.center) &&
  warning.center.length === 2 &&
  warning.center.every(item => Number.isFinite(Number(item)))

const createWarningMarkerSvg = ({ color, label, shadow }: (typeof levelStyleMap)[WarningLevel]) => `
<svg width="34" height="38" viewBox="0 0 34 38" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="17" cy="34" rx="8" ry="3" fill="${shadow}" opacity="0.42"/>
  <circle cx="17" cy="16" r="13" fill="#fff" opacity="0.96"/>
  <circle cx="17" cy="16" r="10.5" fill="${color}"/>
  <circle cx="17" cy="16" r="13" fill="none" stroke="#fff" stroke-width="3"/>
  <circle cx="17" cy="16" r="10.5" fill="none" stroke="rgba(255,255,255,0.58)" stroke-width="1"/>
  <path d="M12 28h10l-5 7z" fill="#fff" opacity="0.96"/>
  <path d="M13.8 27.4h6.4L17 32.8z" fill="${color}"/>
  <text x="17" y="20.2" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="13" font-weight="800" fill="#fff">${label}</text>
</svg>`

const getMarkerIconUrl = (level: WarningLevel) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(createWarningMarkerSvg(levelStyleMap[level]))}`

export const getWarningPointStyle = (level: WarningLevel) =>
  new Style({
    image: new Icon({
      src: getMarkerIconUrl(level),
      anchor: [0.5, 0.92],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
      scale: 1,
    }),
  })

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
  const time = warning.publishedAt || warning.createdAt
  const timeText = time ? new Date(time).toLocaleString() : '-'

  return `
    <div style="font-weight: 600; margin-bottom: 6px;">${warning.title}</div>
    <div>类型：${warningTypeText[warning.type]}</div>
    <div>等级：${warningLevelText[warning.level]}</div>
    <div>范围：${warning.radius || 0} km</div>
    <div>时间：${timeText}</div>
    <div style="margin-top: 6px; max-width: 260px; white-space: normal;">${warning.description || '-'}</div>
  `
}
