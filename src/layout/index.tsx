import { useMemo } from 'react'
import { AppstoreOutlined, GlobalOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, message } from 'antd'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { UserLogout } from '@/services/user'
import { clearAuth } from '@/utils/auth'
import style from './index.module.scss'

const AppLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [messageApi, contextHolder] = message.useMessage()

  const navItems = useMemo(
    () => [
      { path: '/dashboard', label: '监控总览', icon: <AppstoreOutlined /> },
      { path: '/map', label: '灾害分布', icon: <GlobalOutlined /> },
    ],
    [],
  )

  const handleLogout = async () => {
    try {
      await UserLogout()
    } catch (error) {
      console.error('logout request failed:', error)
    } finally {
      clearAuth()
      messageApi.success('已安全退出登录')
      navigate('/login')
    }
  }

  return (
    <div className={style.layoutShell}>
      {contextHolder}
      <header className={style.topBar}>
        <div className={style.brandWrap}>
          <span className={style.brandBadge}>气象</span>
          <h1 className={style.brandTitle}>气象灾害综合风险监测平台</h1>
        </div>

        <nav className={style.navWrap}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${style.navItem} ${isActive || location.pathname === item.path ? style.navItemActive : ''}`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={style.userWrap}>
          <Avatar icon={<UserOutlined />} className={style.userAvatar} />
          <span className={style.userText}>管理员</span>
          <Button type="text" icon={<LogoutOutlined />} className={style.logoutBtn} onClick={handleLogout}>
            退出
          </Button>
        </div>
      </header>

      <main className={style.pageBody}>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
