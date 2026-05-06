import { useState } from 'react'
import type { ReactNode } from 'react'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import styles from './index.module.scss'

const { Sider } = Layout

type SidebarItem = NonNullable<MenuProps['items']>[number]

type SiderBarProps = {
  items: SidebarItem[]
  selectedKeys?: string[]
  collapsed?: boolean
  defaultCollapsed?: boolean
  title?: ReactNode
  badge?: ReactNode
  menuTheme?: 'light' | 'dark'
  onCollapse?: (collapsed: boolean) => void
  onMenuClick?: MenuProps['onClick']
}

const SiderBar = ({
  items,
  selectedKeys = [],
  collapsed,
  defaultCollapsed = false,
  title = '监测平台',
  badge = '气象',
  menuTheme = 'dark',
  onCollapse,
  onMenuClick,
}: SiderBarProps) => {
  const [innerCollapsed, setInnerCollapsed] = useState(defaultCollapsed)
  const isControlled = typeof collapsed === 'boolean'
  const mergedCollapsed = isControlled ? collapsed : innerCollapsed

  const handleCollapse = (nextCollapsed: boolean) => {
    if (!isControlled) {
      setInnerCollapsed(nextCollapsed)
    }
    onCollapse?.(nextCollapsed)
  }

  return (
    <Sider className={styles.sider} collapsible collapsed={mergedCollapsed} onCollapse={handleCollapse}>
      <div className={styles.logoArea}>
        <span className={styles.brandBadge}>{badge}</span>
        {!mergedCollapsed && <span className={styles.logoText}>{title}</span>}
      </div>
      <Menu
        mode="inline"
        theme={menuTheme}
        items={items}
        selectedKeys={selectedKeys}
        onClick={onMenuClick}
      />
    </Sider>
  )
}

export type { SiderBarProps, SidebarItem }
export default SiderBar
