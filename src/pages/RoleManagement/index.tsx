import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
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
  const [keyword, setKeyword] = useState('')
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

  const userCountMap = useMemo(
    () =>
      users.reduce<Record<string, number>>((acc, user) => {
        const role = user.role || 'user'
        acc[role] = (acc[role] || 0) + 1
        return acc
      }, {}),
    [users],
  )

  const filteredRoles = useMemo(() => {
    const value = keyword.trim().toLowerCase()
    if (!value) return roles

    return roles.filter(role =>
      [role.key, role.name, role.description || '', ROLE_LABELS[role.key] || ''].some(item =>
        item.toLowerCase().includes(value),
      ),
    )
  }, [keyword, roles])

  const roleOptions = roles.map(role => ({
    label: ROLE_LABELS[role.key] || role.name,
    value: role.key,
  }))

  const openCreateModal = () => {
    setEditingRole(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEditModal = (role: RoleItem) => {
    setEditingRole(role)
    form.setFieldsValue({
      key: role.key,
      name: role.name,
      description: role.description,
    })
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

  const roleColumns: ColumnsType<RoleItem> = [
    {
      title: '序号',
      width: 72,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: '角色标识',
      dataIndex: 'key',
      render: key => <Text code>{key}</Text>,
    },
    {
      title: '角色名称',
      render: (_, role) => (
        <Space>
          <strong>{ROLE_LABELS[role.key] || role.name}</strong>
          {role.builtin && <Tag color="blue">内置</Tag>}
        </Space>
      ),
    },
    {
      title: '权限数',
      dataIndex: 'permissions',
      width: 110,
      align: 'center',
      render: permissions => <Tag color="green">{permissions.length}</Tag>,
    },
    {
      title: '用户数',
      width: 110,
      align: 'center',
      render: (_, role) => <Tag color="blue">{userCountMap[role.key] || 0}</Tag>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
      render: value => value || <span className={styles.mutedText}>-</span>,
    },
    {
      title: '操作',
      width: 160,
      align: 'center',
      render: (_, role) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(role)}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除角色"
            description={`确认删除 ${role.name}？`}
            disabled={role.builtin}
            onConfirm={() => void deleteRole(role)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={role.builtin}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const userColumns: ColumnsType<AuthUser> = [
    {
      title: '序号',
      width: 72,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: '账号',
      dataIndex: 'account',
    },
    {
      title: '当前角色',
      dataIndex: 'role',
      render: role => <Tag>{ROLE_LABELS[role] || role || 'user'}</Tag>,
    },
    {
      title: '分配角色',
      width: 240,
      render: (_, user) => (
        <Select<UserRole>
          value={user.role || 'user'}
          options={roleOptions}
          style={{ width: 180 }}
          onChange={role => void assignRole(user, role)}
        />
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <Title level={2}>角色管理</Title>
          <Text type="secondary">以表格方式维护角色，并为用户分配角色。</Text>
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

      <section className={styles.tableSection}>
        <div className={styles.tableToolbar}>
          <strong>角色列表</strong>
          <Input.Search
            allowClear
            className={styles.searchInput}
            placeholder="请输入角色名称或标识"
            enterButton={<SearchOutlined />}
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
          />
        </div>
        <Table<RoleItem>
          rowKey="key"
          bordered
          loading={loading}
          dataSource={filteredRoles}
          columns={roleColumns}
          pagination={{ pageSize: 8, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        />
      </section>

      <section className={styles.tableSection}>
        <div className={styles.tableToolbar}>
          <strong>用户角色分配</strong>
          <Text type="secondary">共 {users.length} 个用户</Text>
        </div>
        <Table<AuthUser>
          rowKey="id"
          bordered
          loading={loading}
          dataSource={users}
          columns={userColumns}
          pagination={{ pageSize: 8, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        />
      </section>

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
                {
                  pattern: /^[a-z][a-z0-9_-]*$/,
                  message: '小写字母开头，可包含数字、下划线和中划线',
                },
              ]}
            >
              <Input placeholder="留空将自动生成" />
            </Form.Item>
          )}
          <Form.Item
            label="角色名称"
            name="name"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
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
