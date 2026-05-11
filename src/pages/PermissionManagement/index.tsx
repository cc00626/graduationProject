import { useEffect, useMemo, useState } from 'react'
import type { Key, ReactNode } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  CreatePermission,
  DeletePermission,
  GetCurrentUser,
  GetPermissionCatalog,
  GetRoles,
  UpdatePermission,
  UpdateRolePermissions,
  type PermissionItem,
  type RoleItem,
} from '@/services/user'
import {
  ROLE_LABELS,
  getAuthUser,
  getDefaultRoute,
  hasPermission,
  saveAuthUser,
} from '@/utils/auth'
import styles from './index.module.scss'

const { Title, Text } = Typography

type PermissionTreeRow = {
  title: ReactNode
  key: string
  children?: PermissionTreeRow[]
}

type PermissionFormValues = PermissionItem

const PermissionManagement = () => {
  const navigate = useNavigate()
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [draft, setDraft] = useState<Record<string, string[]>>({})
  const [selectedRoleKey, setSelectedRoleKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState<PermissionItem | null>(null)
  const [permissionSaving, setPermissionSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'page' | 'button'>('all')
  const [permissionForm] = Form.useForm<PermissionFormValues>()

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
      setSelectedRoleKey(current => {
        if (current && roleRes.data.some(role => role.key === current)) return current
        return roleRes.data[0]?.key || ''
      })
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

  const permissionCodes = useMemo(() => new Set(permissions.map(item => item.code)), [permissions])

  const selectedRole = useMemo(
    () => roles.find(role => role.key === selectedRoleKey) || roles[0],
    [roles, selectedRoleKey],
  )

  const checkedPermissionKeys = selectedRole
    ? selectedRole.key === 'super_admin'
      ? permissions.map(item => item.code)
      : draft[selectedRole.key] || []
    : []

  const visiblePermissions = useMemo(() => {
    const value = keyword.trim().toLowerCase()
    return permissions.filter(item => {
      const matchType = typeFilter === 'all' || item.type === typeFilter
      const matchKeyword =
        !value ||
        [item.name, item.code, item.group, item.description || ''].some(text =>
          text.toLowerCase().includes(value),
        )
      return matchType && matchKeyword
    })
  }, [keyword, permissions, typeFilter])

  const selectedRoleOriginalPermissions = useMemo(
    () => selectedRole?.permissions || [],
    [selectedRole?.permissions],
  )

  const hasPermissionChanges = useMemo(() => {
    if (!selectedRole || selectedRole.key === 'super_admin') return false
    const current = [...(draft[selectedRole.key] || [])].sort()
    const origin = [...selectedRoleOriginalPermissions].sort()
    return current.length !== origin.length || current.some((code, index) => code !== origin[index])
  }, [draft, selectedRole, selectedRoleOriginalPermissions])

  const permissionStats = useMemo(() => {
    const enabledCodes = new Set(permissions.map(item => item.code))
    const checked = checkedPermissionKeys.filter(code => enabledCodes.has(String(code))).map(String)
    return {
      total: permissions.length,
      checked: checked.length,
      pageCount: checked.filter(
        code => permissions.find(item => item.code === code)?.type === 'page',
      ).length,
      buttonCount: checked.filter(
        code => permissions.find(item => item.code === code)?.type === 'button',
      ).length,
      visible: visiblePermissions.length,
    }
  }, [checkedPermissionKeys, permissions, visiblePermissions.length])

  const permissionTreeData = useMemo<PermissionTreeRow[]>(() => {
    const grouped = visiblePermissions.reduce<Record<string, PermissionItem[]>>((acc, item) => {
      acc[item.group] = [...(acc[item.group] || []), item]
      return acc
    }, {})

    return Object.entries(grouped).map<PermissionTreeRow>(([group, items]) => ({
      key: `group:${group}`,
      title: <strong className={styles.groupNode}>{group}</strong>,
      children: items.map(item => ({
        key: item.code,
        title: (
          <Space size={8}>
            <span>{item.name}</span>
            <Tag color={item.type === 'page' ? 'green' : 'gold'}>{item.type}</Tag>
            <Text code>{item.code}</Text>
          </Space>
        ),
      })),
    }))
  }, [visiblePermissions])

  const permissionGroupOptions = useMemo(
    () =>
      Array.from(new Set(permissions.map(item => item.group))).map(group => ({
        label: group,
        value: group,
      })),
    [permissions],
  )

  const openCreatePermissionModal = () => {
    setEditingPermission(null)
    permissionForm.resetFields()
    permissionForm.setFieldsValue({ type: 'button', group: '业务权限' } as PermissionFormValues)
    setPermissionModalOpen(true)
  }

  const openEditPermissionModal = (permission: PermissionItem) => {
    setEditingPermission(permission)
    permissionForm.setFieldsValue(permission)
    setPermissionModalOpen(true)
  }

  const savePermission = async () => {
    const values = await permissionForm.validateFields()
    setPermissionSaving(true)
    try {
      const res = editingPermission
        ? await UpdatePermission(editingPermission.code, {
            name: values.name,
            type: values.type,
            group: values.group,
            description: values.description || '',
            builtin: editingPermission.builtin,
          })
        : await CreatePermission({
            code: values.code,
            name: values.name,
            type: values.type,
            group: values.group,
            description: values.description || '',
          })
      if (res.code !== 0) {
        message.error(res.message)
        return
      }
      message.success(res.message || '权限保存成功')
      setPermissionModalOpen(false)
      await loadData()
    } catch {
      message.error('权限保存失败')
    } finally {
      setPermissionSaving(false)
    }
  }

  const deletePermission = async (permission: PermissionItem) => {
    try {
      const res = await DeletePermission(permission.code)
      if (res.code !== 0) {
        message.error(res.message)
        return
      }
      message.success(res.message || '权限删除成功')
      await loadData()
    } catch {
      message.error('权限删除失败')
    }
  }

  const handleTreeCheck = (checkedKeysValue: Key[] | { checked: Key[] }) => {
    if (!selectedRole || selectedRole.key === 'super_admin') return

    const keys = Array.isArray(checkedKeysValue) ? checkedKeysValue : checkedKeysValue.checked
    setDraft(prev => {
      const nextPermissions = keys.map(key => String(key)).filter(code => permissionCodes.has(code))
      return { ...prev, [selectedRole.key]: nextPermissions }
    })
  }

  const updateSelectedRoleDraft = (getNextPermissions: (current: string[]) => string[]) => {
    if (!selectedRole || selectedRole.key === 'super_admin') return

    setDraft(prev => {
      const current = prev[selectedRole.key] || []
      const nextPermissions = getNextPermissions(current).filter(code => permissionCodes.has(code))
      return { ...prev, [selectedRole.key]: Array.from(new Set(nextPermissions)) }
    })
  }

  const selectVisiblePermissions = (type?: 'page' | 'button') => {
    const nextCodes = visiblePermissions
      .filter(item => !type || item.type === type)
      .map(item => item.code)
    updateSelectedRoleDraft(current => [...current, ...nextCodes])
  }

  const clearVisiblePermissions = () => {
    const visibleCodes = new Set(visiblePermissions.map(item => item.code))
    updateSelectedRoleDraft(current => current.filter(code => !visibleCodes.has(code)))
  }

  const resetSelectedRoleDraft = () => {
    if (!selectedRole || selectedRole.key === 'super_admin') return
    setDraft(prev => ({ ...prev, [selectedRole.key]: selectedRole.permissions }))
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
      const currentUser = getAuthUser()
      if (currentUser?.role === role.key) {
        const currentUserRes = await GetCurrentUser()
        if (currentUserRes.code === 0) {
          saveAuthUser(currentUserRes.data)
          window.dispatchEvent(new Event('auth-user-updated'))
          if (!hasPermission('page:permission', currentUserRes.data)) {
            navigate(getDefaultRoute(currentUserRes.data), { replace: true })
            return
          }
        }
      }
      await loadData()
    } catch {
      message.error('权限配置保存失败')
    } finally {
      setSavingKey('')
    }
  }

  const roleColumns = useMemo<ColumnsType<RoleItem>>(
    () => [
      {
        title: '角色',
        render: (_, role) => (
          <div className={styles.roleItem}>
            <div>
              <strong>{ROLE_LABELS[role.key] || role.name}</strong>
              <Text type="secondary">{role.description || '-'}</Text>
            </div>
            {role.builtin && <Tag color="blue">内置</Tag>}
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <Title level={2}>权限管理</Title>
          <Text type="secondary">选择角色后，通过权限树配置页面和按钮权限。</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePermissionModal}>
            新增权限
          </Button>
        </Space>
      </section>

      <div className={styles.rbacLayout}>
        <Card title="角色列表" className={styles.rolePanel}>
          <Table<RoleItem>
            rowKey="key"
            loading={loading}
            dataSource={roles}
            pagination={false}
            columns={roleColumns}
            showHeader={false}
            rowClassName={role =>
              role.key === selectedRole?.key ? styles.selectedRoleRow : styles.roleRow
            }
            onRow={role => ({
              onClick: () => setSelectedRoleKey(role.key),
            })}
          />
        </Card>

        <Card className={styles.permissionPanel}>
          <Tabs
            defaultActiveKey="tree"
            items={[
              {
                key: 'tree',
                label: '角色授权',
                children: (
                  <>
                    <div className={styles.permissionHeader}>
                      <Space wrap>
                        <strong>
                          {selectedRole
                            ? ROLE_LABELS[selectedRole.key] || selectedRole.name
                            : '角色权限'}
                        </strong>
                        {selectedRole?.builtin && <Tag color="blue">内置角色</Tag>}
                        {selectedRole?.key === 'super_admin' && <Tag color="red">默认全部权限</Tag>}
                        {hasPermissionChanges && <Tag color="orange">未保存</Tag>}
                      </Space>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        disabled={
                          !selectedRole ||
                          selectedRole.key === 'super_admin' ||
                          !hasPermissionChanges
                        }
                        loading={selectedRole ? savingKey === selectedRole.key : false}
                        onClick={() => selectedRole && void saveRolePermissions(selectedRole)}
                      >
                        {hasPermissionChanges ? '保存权限' : '已保存'}
                      </Button>
                    </div>

                    <div className={styles.permissionToolbar}>
                      <Space wrap>
                        <Input.Search
                          allowClear
                          placeholder="搜索权限名称、编码、分组"
                          value={keyword}
                          onChange={event => setKeyword(event.target.value)}
                          style={{ width: 260 }}
                        />
                        <Select
                          value={typeFilter}
                          style={{ width: 128 }}
                          options={[
                            { label: '全部类型', value: 'all' },
                            { label: '页面权限', value: 'page' },
                            { label: '按钮权限', value: 'button' },
                          ]}
                          onChange={setTypeFilter}
                        />
                      </Space>
                      <Space wrap>
                        <Button
                          disabled={!selectedRole || selectedRole.key === 'super_admin'}
                          onClick={() => selectVisiblePermissions()}
                        >
                          全选当前
                        </Button>
                        <Button
                          disabled={!selectedRole || selectedRole.key === 'super_admin'}
                          onClick={() => selectVisiblePermissions('page')}
                        >
                          勾选页面
                        </Button>
                        <Button
                          disabled={!selectedRole || selectedRole.key === 'super_admin'}
                          onClick={() => selectVisiblePermissions('button')}
                        >
                          勾选按钮
                        </Button>
                        <Button
                          disabled={!selectedRole || selectedRole.key === 'super_admin'}
                          onClick={clearVisiblePermissions}
                        >
                          清空当前
                        </Button>
                        <Button disabled={!hasPermissionChanges} onClick={resetSelectedRoleDraft}>
                          恢复
                        </Button>
                      </Space>
                    </div>

                    <div className={styles.permissionStats}>
                      <span>
                        已选 {permissionStats.checked} / {permissionStats.total}
                      </span>
                      <span>页面 {permissionStats.pageCount}</span>
                      <span>按钮 {permissionStats.buttonCount}</span>
                      <span>当前筛选 {permissionStats.visible}</span>
                    </div>

                    <Tree
                      key={`${keyword}-${typeFilter}`}
                      checkable
                      defaultExpandAll
                      blockNode
                      selectable={false}
                      disabled={selectedRole?.key === 'super_admin'}
                      checkedKeys={checkedPermissionKeys}
                      treeData={permissionTreeData as DataNode[]}
                      onCheck={handleTreeCheck}
                    />
                  </>
                ),
              },
              {
                key: 'catalog',
                label: `权限目录(${visiblePermissions.length})`,
                children: (
                  <Table<PermissionItem>
                    rowKey="code"
                    size="small"
                    loading={loading}
                    dataSource={visiblePermissions}
                    pagination={{ pageSize: 8, hideOnSinglePage: true }}
                    columns={[
                      {
                        title: '权限名称',
                        dataIndex: 'name',
                        render: (_, permission) => (
                          <Space direction="vertical" size={2}>
                            <Space>
                              <strong>{permission.name}</strong>
                              {permission.builtin && <Tag color="blue">内置</Tag>}
                            </Space>
                            <Text code>{permission.code}</Text>
                          </Space>
                        ),
                      },
                      {
                        title: '类型',
                        dataIndex: 'type',
                        width: 90,
                        render: type => (
                          <Tag color={type === 'page' ? 'green' : 'gold'}>{type}</Tag>
                        ),
                      },
                      { title: '分组', dataIndex: 'group', width: 120 },
                      {
                        title: '操作',
                        width: 150,
                        render: (_, permission) => (
                          <Space>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => openEditPermissionModal(permission)}
                            >
                              编辑
                            </Button>
                            <Popconfirm
                              title="删除权限"
                              description={`确认删除 ${permission.name}？`}
                              disabled={permission.builtin}
                              onConfirm={() => void deletePermission(permission)}
                            >
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={permission.builtin}
                              >
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Modal
        title={editingPermission ? '编辑权限' : '新增权限'}
        open={permissionModalOpen}
        okText="保存"
        confirmLoading={permissionSaving}
        onOk={() => void savePermission()}
        onCancel={() => setPermissionModalOpen(false)}
      >
        <Form form={permissionForm} layout="vertical">
          <Form.Item
            label="权限码"
            name="code"
            rules={[
              { required: true, message: '请输入权限码' },
              {
                pattern: /^[a-z][a-z0-9:_-]*$/,
                message: '小写字母开头，可包含数字、冒号、下划线和中划线',
              },
            ]}
          >
            <Input
              disabled={Boolean(editingPermission)}
              placeholder="例如 page:report 或 button:report:export"
            />
          </Form.Item>
          <Form.Item
            label="权限名称"
            name="name"
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder="请输入权限名称" />
          </Form.Item>
          <Form.Item
            label="权限类型"
            name="type"
            rules={[{ required: true, message: '请选择权限类型' }]}
          >
            <Select
              options={[
                { label: '页面权限', value: 'page' },
                { label: '按钮权限', value: 'button' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="权限分组"
            name="group"
            rules={[{ required: true, message: '请输入权限分组' }]}
          >
            <Select
              showSearch
              options={permissionGroupOptions}
              placeholder="选择或输入分组"
              onSearch={value => {
                if (value) {
                  permissionForm.setFieldValue('group', value)
                }
              }}
            />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} maxLength={120} placeholder="请输入权限说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PermissionManagement
