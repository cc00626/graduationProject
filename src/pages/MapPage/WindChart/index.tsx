import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface WindChartProps {
  data: { district: string; levelCounts: number[] }[]
}

const WindDistributionChart: React.FC<WindChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const myChart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (chartRef.current) {
      myChart.current = echarts.init(chartRef.current)
    }

    const handleResize = () => myChart.current?.resize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!myChart.current || !data.length) return

    const districtNames = data.map(item => item.district)
    const levels = ['一级', '二级', '三级', '四级', '五级']
    const colors = [
      'rgba(0, 191, 255, 0.7)',
      'rgba(173, 255, 47, 0.7)',
      'rgba(255, 255, 0, 0.7)',
      'rgba(255, 126, 0, 0.7)',
      'rgba(255, 0, 0, 0.7)',
    ]

    const series = levels.map((name, index) => ({
      name,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      itemStyle: {
        color: colors[index],
        borderRadius: 4,
      },
      data: data.map(item => item.levelCounts[index] || 0),
    }))

    const option = {
      backgroundColor: 'rgba(8, 32, 58, 0.3)',
      title: {
        text: '各区风力等级站点统计',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 600, color: '#eaf4ff' },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { color: '#d7eaff', fontSize: 12 },
      },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: districtNames,
        axisLabel: { interval: 0, rotate: 30, color: '#cfe3f8' },
        axisLine: { lineStyle: { color: 'rgba(207, 227, 248, 0.45)' } },
      },
      yAxis: {
        type: 'value',
        name: '站点数',
        nameTextStyle: { color: '#cfe3f8' },
        axisLabel: { color: '#cfe3f8' },
        splitLine: { lineStyle: { color: 'rgba(207, 227, 248, 0.2)' } },
      },
      series,
    }

    myChart.current.setOption(option)
  }, [data])

  return <div ref={chartRef} style={{ width: '100%', height: '300px' }} />
}

export default WindDistributionChart
