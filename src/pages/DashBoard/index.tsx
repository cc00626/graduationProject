import { type FC } from 'react'
import { AlertOutlined, BarChartOutlined, RiseOutlined, ThunderboltOutlined } from '@ant-design/icons'
import OlRiskMap from './components/OlRiskMap'
import style from './index.module.scss'

const summaryCards = [
  { title: '记录总数', value: '12,578', unit: '条', trend: '+3.4%' },
  { title: '预警完成率', value: '81%', unit: '', trend: '+1.2%' },
]

const alerts = [
  'A1 暴雨蓝色预警信号（进行中）',
  'A1 雷电黄色预警信号（进行中）',
  'A3 大风蓝色预警信号（发布）',
  'A4 地质灾害风险提示（关注）',
  'A5 山洪灾害短临提醒（发布）',
]

const areaData = [
  { area: '天河区', value: 27 },
  { area: '白云区', value: 31 },
  { area: '番禺区', value: 22 },
  { area: '南沙区', value: 12 },
  { area: '增城区', value: 18 },
  { area: '从化区', value: 15 },
]

const gauges = [
  { name: '降雨', pct: 74 },
  { name: '风速', pct: 53 },
  { name: '湿度', pct: 87 },
  { name: '气压', pct: 64 },
  { name: '雷达', pct: 69 },
  { name: '能见度', pct: 42 },
]

const districtRisk = {
  荔湾区: 1,
  越秀区: 2,
  海珠区: 1,
  天河区: 2,
  白云区: 3,
  黄埔区: 2,
  番禺区: 2,
  花都区: 1,
  南沙区: 1,
  从化区: 1,
  增城区: 3,
} as const

const markerValues = [
  { name: '白云区', coord: [113.27324, 23.15792] as [number, number], value: 27703 },
  { name: '天河区', coord: [113.36199, 23.12463] as [number, number], value: 19143 },
  { name: '增城区', coord: [113.82958, 23.2905] as [number, number], value: 25660 },
]

const DashBoard: FC = () => {
  return (
    <div className={style.screen}>
      <section className={style.centerStage}>
        <header className={style.stageTitle}>广州市气象灾害风险实时态势分布</header>
        <div className={style.mapBoard}>
          <OlRiskMap riskByDistrict={districtRisk} markers={markerValues} />
        </div>
      </section>

      <aside className={style.rightPanel}>
        <div className={style.cardGrid}>
          {summaryCards.map(card => (
            <article key={card.title} className={style.card + ' ' + style.summaryCard}>
              <div className={style.cardHeader}>
                <BarChartOutlined />
                <span>{card.title}</span>
              </div>
              <div className={style.bigValue}>
                {card.value}
                <small>{card.unit}</small>
              </div>
              <div className={style.trendText}>
                <RiseOutlined /> {card.trend}
              </div>
            </article>
          ))}
        </div>

        <article className={style.card}>
          <div className={style.cardHeader}>
            <AlertOutlined />
            <span>告警统计</span>
          </div>
          <ul className={style.alertList}>
            {alerts.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className={style.card}>
          <div className={style.cardHeader}>
            <ThunderboltOutlined />
            <span>传感器状态占比</span>
          </div>
          <div className={style.donutWrap}>
            <div className={style.donut}>
              <strong>86%</strong>
              <span>在线</span>
            </div>
            <div className={style.legendList}>
              <span>
                <i className={style.legend1}></i>在线 86%
              </span>
              <span>
                <i className={style.legend2}></i>离线 9%
              </span>
              <span>
                <i className={style.legend3}></i>异常 5%
              </span>
            </div>
          </div>
        </article>
      </aside>

      <section className={style.bottomPanel}>
        <article className={style.card}>
          <div className={style.cardHeader}>
            <BarChartOutlined />
            <span>各区告警记录数</span>
          </div>
          <div className={style.barChart}>
            {areaData.map(item => (
              <div key={item.area} className={style.barItem}>
                <div className={style.barTrack}>
                  <div className={style.barFill} style={{ height: `${item.value * 2.2}px` }}></div>
                </div>
                <span className={style.barLabel}>{item.area}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={style.card}>
          <div className={style.cardHeader}>
            <RiseOutlined />
            <span>综合风险指数</span>
          </div>
          <div className={style.lineFake}></div>
        </article>

        <article className={style.card}>
          <div className={style.cardHeader}>
            <ThunderboltOutlined />
            <span>监测因子实时率</span>
          </div>
          <div className={style.gaugeGrid}>
            {gauges.map(item => (
              <div key={item.name} className={style.gaugeItem}>
                <span>{item.name}</span>
                <div className={style.gaugeTrack}>
                  <div className={style.gaugeFill} style={{ width: `${item.pct}%` }}></div>
                </div>
                <b>{item.pct}%</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

export default DashBoard
