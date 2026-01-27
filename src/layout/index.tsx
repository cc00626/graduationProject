import React, { useState } from 'react'
import {
  DesktopOutlined,
  FileTextOutlined,
  GlobalOutlined,
  AlertOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Layout, theme, Typography, Avatar, Space } from 'antd'
import SiderBar from './components/SiderBar'
import { Outlet, useNavigate } from 'react-router-dom'

const { Header, Content } = Layout
const { Title } = Typography

const AppLayout = () => {
  const navigate = useNavigate()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <SiderBar />
      <Layout>
        {/* 顶部栏 */}
        <Header
          style={{
            padding: '0 16px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            广州市气象灾害检测与预警系统
          </Title>
          <Space>
            <Avatar icon={<UserOutlined />} />
            <span>管理员：陈久祥</span>
          </Space>
        </Header>

        {/* 内容区 */}
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 'calc(100vh - 112px)',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              position: 'relative', // 为绝对定位的地图容器做准备
            }}
          >
            {/* 路由子组件渲染位置 */}
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
