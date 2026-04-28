import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Space, Table, Tag, Typography, message } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import {
  GetPermissionCatalog,
  GetRoles,
  UpdateRolePermissions,
  type PermissionItem,
  type RoleItem,
} from '@/services/user'
import { ROLE_LABELS } from '@/utils/auth'
import styles from './index.module.scss'

const { Title, Text } = Typography

const PermissionManagement = () => {
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [draft, setDraft] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [permissionRes, roleRes] = await Promise.all([GetPermissionCatalog(), GetRoles()])
      if (permissionRes.code !== 0 || roleRes.code !== 0) {
        message.error(permissionRes.message || roleRes.message || '权限数据加载失败')
        return
      }

      setPermissions(permissionRes.data)
      setRoles(roleRes.data)
      setDraft(
        roleRes.data.reduce<Record<string, string[]>>((acc, role) => {
          acc[role.key] = role.permissions
          return acc
        }, {}),
      )
    } catch {
      message.error('权限数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const groupedPermissions = useMemo(
    () =>
      permissions.reduce<Record<string, PermissionItem[]>>((acc, item) => {
        acc[item.group] = [...(acc[item.group] || []), item]
        return acc
      }, {}),
    [permissions],
  )

  const handleCheck = (roleKey: string, permissionCode: string, checked: boolean) => {
    setDraft(prev => {
      const next = new Set(prev[roleKey] || [])
      if (checked) {
        next.add(permissionCode)
      } else {
        next.delete(permissionCode)
      }
      return { ...prev, [roleKey]: Array.from(next) }
    })
  }

  const saveRolePermissions = async (role: RoleItem) => {
    setSavingKey(role.key)
    try {
      const res = await UpdateRolePermissions(role.key, draft[role.key] || [])
      if (res.code !== 0) {
        message.error(res.message)
        return
      }
      message.success(res.message || '权限配置保存成功')
      await loadData()
    } catch {
      message.error('权限配置保存失败')
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <Title level={2}>权限管理</Title>
          <Text type="secondary">按角色配置页面访问权限和按钮操作权限。</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
          刷新
        </Button>
      </section>

      <Alert
        showIcon
        type="info"
        message="页面权限会控制菜单入口；按钮权限会控制新增、编辑、发布、删除等操作。"
        className={styles.notice}
      />

      <Table<RoleItem>
        rowKey="key"
        loading={loading}
        dataSource={roles}
        pagination={false}
        columns={[
          {
            title: '角色',
            width: 180,
            render: (_, role) => (
              <Space direction="vertical" size={4}>
                <Space>
                  <strong>{ROLE_LABELS[role.key] || role.name}</strong>
                  {role.builtin && <Tag color="blue">内置</Tag>}
                </Space>
                <Text type="secondary">{role.description || '-'}</Text>
              </Space>
            ),
          },
          {
            title: '页面和按钮权限',
            render: (_, role) => (
              <div className={styles.permissionGrid}>
                {Object.entries(groupedPermissions).map(([group, items]) => (
                  <div key={group} className={styles.group}>
                    <div className={styles.groupTitle}>{group}</div>
                    <Space wrap>
                      {items.map(item => (
                        <Checkbox
                          key={item.code}
                          checked={(draft[role.key] || []).includes(item.code)}
                          disabled={role.key === 'super_admin'}
                          onChange={event => handleCheck(role.key, item.code, event.target.checked)}
                        >
                          <Tag color={item.type === 'page' ? 'green' : 'gold'}>{item.type}</Tag>
                          {item.name}
                        </Checkbox>
                      ))}
                    </Space>
                  </div>
                ))}
              </div>
            ),
          },
          {
            title: '操作',
            width: 130,
            render: (_, role) => (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={role.key === 'super_admin'}
                loading={savingKey === role.key}
                onClick={() => void saveRolePermissions(role)}
              >
                保存
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}

export default PermissionManagement
