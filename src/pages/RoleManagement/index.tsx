import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
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

      <Table<RoleItem>
        rowKey="key"
        loading={loading}
        dataSource={roles}
        pagination={false}
        className={styles.table}
        columns={[
          {
            title: '角色名称',
            render: (_, role) => (
              <Space>
                <strong>{ROLE_LABELS[role.key] || role.name}</strong>
                {role.builtin && <Tag color="blue">内置</Tag>}
              </Space>
            ),
          },
          { title: '角色标识', dataIndex: 'key' },
          { title: '说明', dataIndex: 'description' },
          {
            title: '权限数',
            width: 100,
            render: (_, role) => <Tag>{role.permissions.length}</Tag>,
          },
          {
            title: '操作',
            width: 190,
            render: (_, role) => (
              <Space>
                <Button size="small" icon={<SaveOutlined />} onClick={() => openEditModal(role)}>
                  编辑
                </Button>
                <Popconfirm
                  title="删除角色"
                  description={`确认删除 ${role.name}？`}
                  disabled={role.builtin}
                  onConfirm={() => void deleteRole(role)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={role.builtin}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Table<AuthUser>
        rowKey="id"
        loading={loading}
        dataSource={users}
        pagination={false}
        className={styles.table}
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
