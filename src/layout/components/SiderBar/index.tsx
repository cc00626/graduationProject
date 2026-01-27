import React, { useState } from 'react'
import { Layout, Menu } from 'antd'
import { DesktopOutlined, FileTextOutlined, GlobalOutlined, AlertOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
const { Sider } = Layout
const SiderBar = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  //菜单栏
  const menuItems = [
    { key: '/dashboard', icon: <DesktopOutlined />, label: '监测仪表盘' },
    { key: '/map', icon: <GlobalOutlined />, label: '灾害分布图' },
    { key: '/alerts', icon: <AlertOutlined />, label: '预警信息管理' },
    { key: '/reports', icon: <FileTextOutlined />, label: '统计报表' },
  ]
  return (
    <Sider collapsible collapsed={collapsed} onCollapse={value => setCollapsed(value)}>
      <div
        style={{
          height: 32,
          margin: 16,
          background: 'rgba(255,255,255,.2)',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '32px',
        }}
      >
        {collapsed ? 'GIS' : '广州气象监测'}
      </div>
      <Menu
        theme="dark"
        defaultSelectedKeys={['/dashboard']}
        mode="inline"
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  )
}
export default SiderBar
