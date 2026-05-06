import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import {
  CreateRole,
  DeleteRole,
  GetRoles,
  GetUsers,
  UpdateRole,
  UpdateUserRole,
  type RoleItem,
} from '@/services/user'
import { ROLE_LABELS, type AuthUser, type UserRole } from '@/utils/auth'
import styles from './index.module.scss'

const { Title, Text } = Typography

type RoleFormValues = {
  key?: string
  name: string
  description?: string
}

const RoleManagement = () => {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [selectedRoleKey, setSelectedRoleKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<RoleFormValues>()

  const loadData = async () => {
    setLoading(true)
    try {
      const [roleRes, userRes] = await Promise.all([GetRoles(), GetUsers()])
      if (roleRes.code !== 0 || userRes.code !== 0) {
        message.error(roleRes.message || userRes.message || '角色数据加载失败')
        return
      }
      setRoles(roleRes.data)
      setUsers(userRes.data)
      setSelectedRoleKey(current => {
        if (current && roleRes.data.some(role => role.key === current)) return current
        return roleRes.data[0]?.key || ''
      })
    } catch {
      message.error('角色数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const openCreateModal = () => {
    setEditingRole(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEditModal = (role: RoleItem) => {
    setEditingRole(role)
    form.setFieldsValue(role)
    setModalOpen(true)
  }

  const saveRole = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = editingRole
        ? await UpdateRole(editingRole.key, values)
        : await CreateRole({ ...values, permissions: ['page:monitor:rain', 'page:setting'] })
      if (res.code !== 0) {
        message.error(res.message)
        return
      }
      message.success(res.message || '角色保存成功')
      setModalOpen(false)
      await loadData()
    } catch {
      message.error('角色保存失败')
    } finally {
      setSaving(false)
    }
  }

  const deleteRole = async (role: RoleItem) => {
    try {
      const res = await DeleteRole(role.key)
      if (res.code !== 0) {
        message.error(res.message)
        return
      }
      message.success(res.message || '角色删除成功')
      await loadData()
    } catch {
      message.error('角色删除失败')
    }
  }

  const assignRole = async (user: AuthUser, role: UserRole) => {
    try {
      const res = await UpdateUserRole(user.id, role)
      if (res.code !== 0) {
        message.error(res.message)
        return
      }
      message.success(res.message || '角色分配成功')
      await loadData()
    } catch {
      message.error('角色分配失败')
    }
  }

  const roleOptions = roles.map(role => ({
    label: ROLE_LABELS[role.key] || role.name,
    value: role.key,
  }))

  const selectedRole = useMemo(
    () => roles.find(role => role.key === selectedRoleKey) || roles[0],
    [roles, selectedRoleKey],
  )

  const selectedRoleUsers = useMemo(
    () => users.filter(user => (user.role || 'user') === selectedRole?.key),
    [selectedRole?.key, users],
  )

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <Title level={2}>角色管理</Title>
          <Text type="secondary">新增业务角色，并把角色分配给系统用户。</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            添加角色
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
            showHeader={false}
            columns={[
              {
                render: (_, role) => (
                  <div className={styles.roleItem}>
                    <div>
                      <Space>
                        <strong>{ROLE_LABELS[role.key] || role.name}</strong>
                        {role.builtin && <Tag color="blue">内置</Tag>}
                      </Space>
                      <Text type="secondary">{role.description || '-'}</Text>
                    </div>
                    <Tag>{role.permissions.length} 权限</Tag>
                  </div>
                ),
              },
            ]}
            rowClassName={role =>
              role.key === selectedRole?.key ? styles.selectedRoleRow : styles.roleRow
            }
            onRow={role => ({
              onClick: () => setSelectedRoleKey(role.key),
            })}
          />
        </Card>

        <div className={styles.detailColumn}>
          <Card
            title="角色详情"
            extra={
              selectedRole && (
                <Space>
                  <Button icon={<SaveOutlined />} onClick={() => openEditModal(selectedRole)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="删除角色"
                    description={`确认删除 ${selectedRole.name}？`}
                    disabled={selectedRole.builtin}
                    onConfirm={() => void deleteRole(selectedRole)}
                  >
                    <Button danger icon={<DeleteOutlined />} disabled={selectedRole.builtin}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          >
            {selectedRole && (
              <Descriptions column={2} size="middle">
                <Descriptions.Item label="角色名称">
                  <Space>
                    <strong>{ROLE_LABELS[selectedRole.key] || selectedRole.name}</strong>
                    {selectedRole.builtin && <Tag color="blue">内置</Tag>}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="角色标识">
                  <Text code>{selectedRole.key}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="权限数量">
                  <Tag color="green">{selectedRole.permissions.length}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="用户数量">
                  <Tag color="blue">{selectedRoleUsers.length}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="说明" span={2}>
                  {selectedRole.description || '-'}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          <Card title="用户角色分配" className={styles.userPanel}>
            <Table<AuthUser>
              rowKey="id"
              loading={loading}
              dataSource={users}
              pagination={false}
              columns={[
                { title: '用户', dataIndex: 'account' },
                {
                  title: '当前角色',
                  dataIndex: 'role',
                  render: (role: UserRole) => <Tag>{ROLE_LABELS[role] || role}</Tag>,
                },
                {
                  title: '分配角色',
                  width: 260,
                  render: (_, user) => (
                    <Select<UserRole>
                      value={user.role || 'user'}
                      options={roleOptions}
                      style={{ width: 200 }}
                      onChange={role => void assignRole(user, role)}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      <Modal
        title={editingRole ? '编辑角色' : '添加角色'}
        open={modalOpen}
        okText="保存"
        confirmLoading={saving}
        onOk={() => void saveRole()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          {!editingRole && (
            <Form.Item
              label="角色标识"
              name="key"
              rules={[
                { pattern: /^[a-z][a-z0-9_-]*$/, message: '小写字母开头，可包含数字、下划线和中划线' },
              ]}
            >
              <Input placeholder="留空将自动生成" />
            </Form.Item>
          )}
          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item label="角色说明" name="description">
            <Input.TextArea placeholder="请输入角色说明" rows={3} maxLength={120} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RoleManagement
