import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { WeatherNowItem, WeatherNowResponse } from '@/services/wind'
import type { FloodRiskSummary } from '../floodRisk/types'
import style from './index.module.scss'

type WindDistrictData = {
  district: string
  levelCounts: number[]
}

type DistrictInsightPanelProps = {
  districtName: string | null
  windDetail: WindDistrictData | null
  weatherNow: WeatherNowItem | null
  weatherMeta: WeatherNowResponse | null
  weatherLoading: boolean
  floodRiskSummary: FloodRiskSummary | null
}

type ViewMode = 'wind' | 'weather' | 'risk'

const levelLabels = ['一级', '二级', '三级', '四级', '五级']
const levelColors = ['#6fd3ff', '#59d39b', '#f7d76c', '#ffb067', '#ff6b6b']

const parseWindPower = (value?: string) => {
  if (!value) return 0
  const match = value.match(/\d+(\.\d+)?/)
  return match ? Number(match[0]) : 0
}

const DistrictInsightPanel: React.FC<DistrictInsightPanelProps> = ({
  districtName,
  windDetail,
  weatherNow,
  weatherMeta,
  weatherLoading,
  floodRiskSummary,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('wind')
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    chartInstanceRef.current = echarts.init(chartRef.current)
    const handleResize = () => chartInstanceRef.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartInstanceRef.current) return

    if (viewMode === 'wind') {
      const counts = windDetail?.levelCounts ?? [0, 0, 0, 0, 0]
      chartInstanceRef.current.setOption({
        backgroundColor: 'transparent',
        animationDuration: 500,
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 18, right: 18, bottom: 26, left: 18, containLabel: true },
        xAxis: {
          type: 'category',
          data: levelLabels,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: 'rgba(180, 215, 255, 0.3)' } },
          axisLabel: { color: '#dcecff' },
        },
        yAxis: {
          type: 'value',
          splitNumber: 4,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: 'rgba(220, 236, 255, 0.72)' },
          splitLine: { lineStyle: { color: 'rgba(180, 215, 255, 0.14)' } },
        },
        series: [
          {
            type: 'bar',
            barWidth: '42%',
            data: counts.map((value, index) => ({
              value,
              itemStyle: {
                color: levelColors[index],
                borderRadius: [8, 8, 0, 0],
                shadowBlur: 14,
                shadowColor: 'rgba(0, 0, 0, 0.2)',
              },
            })),
            label: {
              show: true,
              position: 'top',
              color: '#f5fbff',
            },
          },
        ],
      })
      return
    }

    if (viewMode === 'weather') {
      const windPower = parseWindPower(weatherNow?.windpower)
      chartInstanceRef.current.setOption({
        backgroundColor: 'transparent',
        animationDuration: 500,
        radar: {
          center: ['50%', '52%'],
          radius: '64%',
          splitNumber: 4,
          axisName: { color: '#dcecff', fontSize: 12 },
          splitLine: { lineStyle: { color: 'rgba(180, 215, 255, 0.18)' } },
          splitArea: { areaStyle: { color: ['rgba(255,255,255,0.01)', 'rgba(255,255,255,0.03)'] } },
          axisLine: { lineStyle: { color: 'rgba(180, 215, 255, 0.18)' } },
          indicator: [
            { name: '温度', max: 50 },
            { name: '湿度', max: 100 },
            { name: '风力', max: 12 },
          ],
        },
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'radar',
            symbol: 'circle',
            symbolSize: 8,
            data: [
              {
                value: [
                  Number(weatherNow?.temperature_float ?? weatherNow?.temperature ?? 0),
                  Number(weatherNow?.humidity_float ?? weatherNow?.humidity ?? 0),
                  windPower,
                ],
                areaStyle: { color: 'rgba(110, 200, 255, 0.22)' },
                lineStyle: { color: '#76d6ff', width: 2 },
                itemStyle: { color: '#dff7ff' },
              },
            ],
          },
        ],
      })
      return
    }

    chartInstanceRef.current.clear()
  }, [viewMode, weatherNow, windDetail])

  useEffect(() => {
    if (floodRiskSummary && viewMode !== 'risk') {
      setViewMode('risk')
    }
  }, [floodRiskSummary, viewMode])

  const hasVisibleData =
    districtName || windDetail || weatherNow || weatherMeta || floodRiskSummary
  if (!hasVisibleData) return null

  return (
    <aside className={style.panel}>
      <div className={style.panelHeader}>
        <div>
          <p className={style.eyebrow}>区域观察</p>
          <h3>{districtName || weatherNow?.city || floodRiskSummary?.title || '区域详情'}</h3>
        </div>
        <div className={style.tabs}>
          <button
            type="button"
            className={viewMode === 'wind' ? style.tabActive : style.tab}
            onClick={() => setViewMode('wind')}
          >
            风力
          </button>
          <button
            type="button"
            className={viewMode === 'weather' ? style.tabActive : style.tab}
            onClick={() => setViewMode('weather')}
          >
            天气
          </button>
          <button
            type="button"
            className={viewMode === 'risk' ? style.tabActive : style.tab}
            onClick={() => setViewMode('risk')}
          >
            风险
          </button>
        </div>
      </div>

      {(viewMode === 'wind' || viewMode === 'weather') && (
        <div className={style.chartShell}>
          <div ref={chartRef} className={style.chart} />
        </div>
      )}

      {viewMode === 'wind' && (
        <div className={style.metricsGrid}>
          {levelLabels.map((label, index) => (
            <div key={label} className={style.metricCard}>
              <span className={style.metricLabel}>{label}</span>
              <strong className={style.metricValue}>{windDetail?.levelCounts[index] ?? 0}</strong>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'weather' && (
        <div className={style.infoStack}>
          {weatherLoading && <div className={style.emptyState}>实时天气加载中...</div>}

          {!weatherLoading && (
            <>
              <div className={style.kvGrid}>
                <div className={style.kvItem}>
                  <span>省份</span>
                  <strong>{weatherNow?.province || '--'}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>城市</span>
                  <strong>{weatherNow?.city || '--'}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>天气</span>
                  <strong>{weatherNow?.weather || '--'}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>温度</span>
                  <strong>{weatherNow?.temperature || '--'}°C</strong>
                </div>
                <div className={style.kvItem}>
                  <span>风向</span>
                  <strong>{weatherNow?.winddirection || '--'}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>风力</span>
                  <strong>{weatherNow?.windpower || '--'}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>湿度</span>
                  <strong>{weatherNow?.humidity || '--'}%</strong>
                </div>
                <div className={style.kvItem}>
                  <span>接口状态</span>
                  <strong>{weatherMeta?.data?.info || '--'}</strong>
                </div>
              </div>
              <div className={style.footerNote}>发布时间 {weatherNow?.reporttime || '--'}</div>
            </>
          )}
        </div>
      )}

      {viewMode === 'risk' && (
        <div className={style.infoStack}>
          {!floodRiskSummary && <div className={style.emptyState}>当前天气未触发洪涝模拟</div>}

          {floodRiskSummary && (
            <>
              <div className={style.kvGrid}>
                <div className={style.kvItem}>
                  <span>预警主题</span>
                  <strong>{floodRiskSummary.title}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>天气条件</span>
                  <strong>{floodRiskSummary.weather}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>预警河流数</span>
                  <strong>{floodRiskSummary.warningRiverCount}</strong>
                </div>
                <div className={style.kvItem}>
                  <span>受影响点位</span>
                  <strong>{floodRiskSummary.affectedCount}</strong>
                </div>
              </div>

              <div className={style.riskList}>
                {floodRiskSummary.affectedSites.length === 0 && (
                  <div className={style.emptyState}>当前缓冲区内暂无风险点</div>
                )}

                {floodRiskSummary.affectedSites.map(site => (
                  <div key={`${site.name}-${site.type}`} className={style.riskItem}>
                    <div>
                      <strong>{site.name}</strong>
                      <span>{site.type}</span>
                    </div>
                    <em className={site.riskLevel === 'high' ? style.riskHigh : style.riskMedium}>
                      {site.riskLevel === 'high' ? '高风险' : '中风险'}
                    </em>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

export default DistrictInsightPanel
