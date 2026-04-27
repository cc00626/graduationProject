import React, { useEffect, useState } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Row, Col, Descriptions, Tag } from 'antd'
import { LeftOutlined, FileTextOutlined, RocketOutlined } from '@ant-design/icons'
import style from './index.module.scss' // 建议新建样式文件

const EmergencyDetail = () => {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  // 获取 MapPage 传过来的站点原始数据
  const stationData = location.state || {}

  return (
    <div className={style.container}>
      {/* 顶部导航 */}
      <div className={style.header}>
        <Button icon={<LeftOutlined />} onClick={() => navigate(-1)} type="link">
          返回监测大屏
        </Button>
        <span className={style.title}>应急指挥调度面板 - {stationData.name || id}</span>
      </div>

      <Row gutter={[16, 16]} className={style.content}>
        {/* 左侧：GIS 局部分析 */}
        <Col span={14}>
          <Card title="周边 5km 资源分析" className={style.mapCard}>
            <div id="detailMap" className={style.detailMap}>
              {/* 这里可以再初始化一个 OpenLayers 实例，专门看缓冲区 */}
              <div className={style.mapPlaceholder}>GIS 缓冲区分析图层加载中...</div>
            </div>
            <div className={style.resourceList}>
              <Tag color="red">3 个消防站</Tag>
              <Tag color="orange">2 个避难所</Tag>
              <Tag color="blue">1 支应急抢修队</Tag>
            </div>
          </Card>
        </Col>

        {/* 右侧：文书与决策 */}
        <Col span={10}>
          {/* 状态统计 */}
          <Card className={style.statusCard}>
            <Descriptions title="实时风险数据" column={2} size="small">
              <Descriptions.Item label="风速">
                <span className={style.dangerValue}>{stationData.wind_speed} m/s</span>
              </Descriptions.Item>
              <Descriptions.Item label="雨量">
                <span className={style.dangerValue}>{stationData.rainfall} mm</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 文档处理系统集成点 */}
          <Card
            title={
              <span>
                <FileTextOutlined /> 自动生成的应急公文
              </span>
            }
            className={style.docCard}
            extra={<Button size="small">在线编辑</Button>}
          >
            <div className={style.docPreview}>
              <h4>关于【{stationData.name}】风险处置的指令</h4>
              <p>据监测，该站风速已达 {stationData.wind_speed}m/s。请各单位立即启动二级响应...</p>
              {/* 这里可以嵌入你之前的文档处理组件 */}
            </div>
            <Button type="primary" danger block icon={<RocketOutlined />} style={{ marginTop: 15 }}>
              一键下发指令
            </Button>
          </Card>

          {/* AI 助手部分 */}
          <Card title="AI 辅助决策建议" className={style.aiCard}>
            <p className={style.aiText}>
              机器人建议：根据当前 5km 范围人口密度，建议立即疏散低洼地区群众...
            </p>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default EmergencyDetail
