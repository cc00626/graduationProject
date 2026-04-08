import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { WindHistoryItem } from '@/services/wind'

interface WindTrendChartProps {
  data: WindHistoryItem[]
}

const getWindValue = (point?: number | { value?: number; station?: string }) => {
  if (typeof point === 'number') return point
  return point?.value ?? 0
}

const getMaxStation = (item: WindHistoryItem) => {
  if (item.maxStation) return item.maxStation
  if (item.maxWind && typeof item.maxWind === 'object' && item.maxWind.station) {
    return item.maxWind.station
  }
  return '最大风速站点'
}

const getMinStation = (item: WindHistoryItem) => {
  if (item.minStation) return item.minStation
  if (item.minWind && typeof item.minWind === 'object' && item.minWind.station) {
    return item.minWind.station
  }
  return '最小风速站点'
}

const formatTime = (time?: string | Date) => {
  if (!time) return '--'
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return time
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mi = `${date.getMinutes()}`.padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

const WindTrendChart: React.FC<WindTrendChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const myChart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (chartRef.current) {
      myChart.current = echarts.init(chartRef.current)
    }

    const handleResize = () => myChart.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      myChart.current?.dispose()
      myChart.current = null
    }
  }, [])

  useEffect(() => {
    if (!myChart.current) return

    const xAxisData = data.map(item => formatTime(item.time))
    const maxWindData = data.map(item => getWindValue(item.maxWind))
    const minWindData = data.map(item => getWindValue(item.minWind))

    myChart.current.setOption({
      backgroundColor: 'rgba(8, 32, 58, 0.3)',
      title: {
        text: '最近风速趋势',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 600, color: '#eaf4ff' },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const idx = params?.[0]?.dataIndex ?? 0
          const row = data[idx]
          const maxStation = getMaxStation(row)
          const minStation = getMinStation(row)
          const maxVal = getWindValue(row?.maxWind)
          const minVal = getWindValue(row?.minWind)
          const timeText = row?.time ? `<div>${row.time}</div>` : ''

          return [
            timeText,
            `<div>最大风速: ${maxVal} (${maxStation})</div>`,
            `<div>最小风速: ${minVal} (${minStation})</div>`,
          ]
            .filter(Boolean)
            .join('')
        },
      },
      legend: {
        top: 28,
        textStyle: { color: '#d7eaff', fontSize: 12 },
      },
      grid: { left: '4%', right: '4%', bottom: '12%', top: 68, containLabel: true },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: { color: '#cfe3f8', interval: 0, rotate: 35 },
        axisLine: { lineStyle: { color: 'rgba(207, 227, 248, 0.45)' } },
      },
      yAxis: {
        type: 'value',
        name: '风速',
        nameTextStyle: { color: '#cfe3f8' },
        axisLabel: { color: '#cfe3f8' },
        splitLine: { lineStyle: { color: 'rgba(207, 227, 248, 0.2)' } },
      },
      series: [
        {
          name: '最大风速',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#ffa940' },
          areaStyle: { color: 'rgba(255, 169, 64, 0.14)' },
          data: maxWindData,
        },
        {
          name: '最小风速',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#40a9ff' },
          areaStyle: { color: 'rgba(64, 169, 255, 0.12)' },
          data: minWindData,
        },
      ],
    })
  }, [data])

  return <div ref={chartRef} style={{ width: '100%', height: '260px' }} />
}

export default WindTrendChart
