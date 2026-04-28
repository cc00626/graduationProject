import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  createWarning,
  deleteWarning,
  getWarnings,
  updateWarning,
  updateWarningStatus,
  type WarningLevel,
  type WarningPayload,
  type WarningRecord,
  type WarningStatus,
  type WarningType,
} from '@/services/warning'
import { canManageWarnings, getUserPreferences, hasPermission } from '@/utils/auth'
import styles from './index.module.scss'

const { TextArea } = Input

type WarningFormValues = {
  title: string
  location: string
  centerText?: string
  type: WarningType
  level: WarningLevel
  status: WarningStatus
  radius: number
  description: string
  publisher?: string
}

type FilterValues = {
  keyword?: string
  type?: WarningType
  level?: WarningLevel
  status?: WarningStatus
}

const typeOptions: Array<{ label: string; value: WarningType }> = [
  { label: '暴雨', value: 'rain' },
  { label: '洪水', value: 'flood' },
  { label: '台风', value: 'typhoon' },
]

const levelOptions: Array<{ label: string; value: WarningLevel }> = [
  { label: '低风险', value: 'low' },
  { label: '中风险', value: 'medium' },
  { label: '高风险', value: 'high' },
]

const statusOptions: Array<{ label: string; value: WarningStatus }> = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已解除', value: 'resolved' },
  { label: '已归档', value: 'archived' },
]

const levelColorMap: Record<WarningLevel, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
}

const statusColorMap: Record<WarningStatus, string> = {
  draft: 'default',
  published: 'blue',
  resolved: 'green',
  archived: 'purple',
}

const labelOf = <T extends string>(options: Array<{ label: string; value: T }>, value?: T) =>
  options.find(item => item.value === value)?.label || '-'

const formatTime = (value?: string) => {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

const formatCenter = (center?: number[]) => {
  if (!center?.length) return ''
  return center.join(', ')
}

const parseCenter = (value?: string) => {
  if (!value?.trim()) return undefined
  const center = value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item))

  return center.length === 2 ? center : undefined
}

const WarningList = () => {
  const userPreferences = useMemo(() => getUserPreferences(), [])
  const canEditWarnings = canManageWarnings()
  const canCreateWarning = hasPermission('button:warning:create')
  const canUpdateWarning = hasPermission('button:warning:update')
  const canPublishWarning = hasPermission('button:warning:publish')
  const canDeleteWarning = hasPermission('button:warning:delete')
  const [form] = Form.useForm<WarningFormValues>()
  const [filterForm] = Form.useForm<FilterValues>()
  const [warnings, setWarnings] = useState<WarningRecord[]>([])
  const [filters, setFilters] = useState<FilterValues>(
    userPreferences.warningLevel === 'high' ? { level: 'high' } : {},
  )
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<WarningRecord | null>(null)

  const loadWarnings = useCallback(
    async (page = pagination.current, pageSize = pagination.pageSize, nextFilters = filters) => {
      setLoading(true)
      try {
        const res = await getWarnings({
          ...nextFilters,
          level:
            nextFilters.level ||
            (userPreferences.warningLevel === 'high' ? 'high' : undefined),
          page,
          pageSize,
        })

        if (res.code === 0) {
          setWarnings(res.data.items)
          setPagination({
            current: res.data.page,
            pageSize: res.data.pageSize,
            total: res.data.total,
          })
        } else {
          message.error(res.message)
        }
      } catch {
        message.error('预警列表加载失败')
      } finally {
        setLoading(false)
      }
    },
    [filters, pagination, userPreferences.warningLevel],
  )

  const displayedWarnings = useMemo(() => {
    if (filters.level || userPreferences.warningLevel !== 'medium') return warnings
    return warnings.filter(warning => warning.level === 'medium' || warning.level === 'high')
  }, [filters.level, userPreferences.warningLevel, warnings])

  useEffect(() => {
    if (userPreferences.warningLevel === 'high') {
      filterForm.setFieldsValue({ level: 'high' })
    }
    void loadWarnings(1, pagination.pageSize, filters)
    // 只在筛选条件变化时重置第一页。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const openCreateModal = () => {
    setEditingRecord(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'rain',
      level: 'low',
      status: 'draft',
      radius: 5,
    })
    setModalOpen(true)
  }

  const openEditModal = (record: WarningRecord) => {
    setEditingRecord(record)
    form.setFieldsValue({
      title: record.title,
      location: record.location,
      centerText: formatCenter(record.center),
      type: record.type,
      level: record.level,
      status: record.status,
      radius: record.radius,
      description: record.description,
      publisher: record.publisher,
    })
    setModalOpen(true)
  }

  const buildPayload = (values: WarningFormValues): WarningPayload => ({
    title: values.title,
    location: values.location,
    center: parseCenter(values.centerText),
    type: values.type,
    level: values.level,
    status: values.status,
    radius: values.radius,
    description: values.description,
    publisher: values.publisher,
    analysis: editingRecord?.analysis,
    pois: editingRecord?.pois,
  })

  const saveWarning = async () => {
    const values = await form.validateFields()
    const payload = buildPayload(values)

    setSaving(true)
    try {
      const res = editingRecord
        ? await updateWarning(editingRecord._id, payload)
        : await createWarning(payload)

      if (res.code === 0) {
        message.success(editingRecord ? '预警已更新' : res.message)
        setModalOpen(false)
        await loadWarnings()
      } else {
        message.error(res.message)
      }
    } catch {
      message.error(editingRecord ? '预警更新失败' : '预警创建失败')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (record: WarningRecord, status: WarningStatus) => {
    try {
      const res = await updateWarningStatus(record._id, status)
      if (res.code === 0) {
        message.success(res.message)
        await loadWarnings()
      } else {
        message.error(res.message)
      }
    } catch {
      message.error('状态更新失败')
    }
  }

  const removeWarning = (record: WarningRecord) => {
    Modal.confirm({
      title: '删除预警',
      content: `确认删除“${record.title}”？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        const res = await deleteWarning(record._id)
        if (res.code === 0) {
          message.success(res.message)
          await loadWarnings()
        } else {
          message.error(res.message)
        }
      },
    })
  }

  const columns: ColumnsType<WarningRecord> = [
    {
      title: '预警标题',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (type: WarningType) => labelOf(typeOptions, type),
    },
    {
      title: '等级',
      dataIndex: 'level',
      width: 95,
      render: (level: WarningLevel) => (
        <Tag color={levelColorMap[level]}>{labelOf(levelOptions, level)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 95,
      render: (status: WarningStatus) => (
        <Tag color={statusColorMap[status]}>{labelOf(statusOptions, status)}</Tag>
      ),
    },
    {
      title: '地点',
      dataIndex: 'location',
      ellipsis: true,
    },
    {
      title: '范围',
      dataIndex: 'radius',
      width: 90,
      render: (radius: number) => `${radius} km`,
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 180,
      render: formatTime,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          {!canEditWarnings ? (
            <Tag>仅查看</Tag>
          ) : (
            <>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={!canUpdateWarning}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          {record.status !== 'published' && canPublishWarning && (
            <Button
              size="small"
              icon={<FileDoneOutlined />}
              onClick={() => void changeStatus(record, 'published')}
            >
              发布
            </Button>
          )}
          {record.status !== 'resolved' && canPublishWarning && (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => void changeStatus(record, 'resolved')}
            >
              解除
            </Button>
          )}
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={!canDeleteWarning}
            onClick={() => removeWarning(record)}
          />
            </>
          )}
        </Space>
      ),
    },
  ]

  const handleTableChange = (nextPagination: TablePaginationConfig) => {
    void loadWarnings(nextPagination.current || 1, nextPagination.pageSize || pagination.pageSize)
  }

  const handleSearch = (values: FilterValues) => {
    setFilters(values)
  }

  const resetSearch = () => {
    filterForm.resetFields()
    const nextFilters = userPreferences.warningLevel === 'high' ? { level: 'high' as const } : {}
    filterForm.setFieldsValue(nextFilters)
    setFilters(nextFilters)
  }

  return (
    <div className={styles.page}>
      <Card className={styles.headerCard}>
        <div className={styles.header}>
          <div>
            <h2>灾害预警列表</h2>
            <p>集中维护已保存的预警记录，支持查询、新增、编辑、删除和状态流转。</p>
            <Tag color="blue">
              已应用系统配置：
              {userPreferences.warningLevel === 'all'
                ? '全部预警'
                : userPreferences.warningLevel === 'medium'
                  ? '中高风险'
                  : '仅高风险'}
            </Tag>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadWarnings()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!canCreateWarning}
              onClick={openCreateModal}
            >
              新增预警
            </Button>
          </Space>
        </div>

        <Form form={filterForm} className={styles.filters} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword">
            <Input allowClear placeholder="搜索标题、地点或描述" prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="type">
            <Select allowClear placeholder="灾害类型" options={typeOptions} />
          </Form.Item>
          <Form.Item name="level">
            <Select allowClear placeholder="风险等级" options={levelOptions} />
          </Form.Item>
          <Form.Item name="status">
            <Select allowClear placeholder="预警状态" options={statusOptions} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={resetSearch}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card className={styles.tableCard}>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={displayedWarnings}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条`,
          }}
          scroll={{ x: 1100 }}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑预警' : '新增预警'}
        open={modalOpen}
        okText={editingRecord ? '保存' : '新增'}
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void saveWarning()}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" className={styles.editorForm}>
          <Form.Item
            label="预警标题"
            name="title"
            rules={[{ required: true, message: '请输入预警标题' }]}
          >
            <Input placeholder="请输入预警标题" />
          </Form.Item>

          <Form.Item
            label="预警地点"
            name="location"
            rules={[{ required: true, message: '请输入预警地点' }]}
          >
            <Input placeholder="经纬度或地点名称" />
          </Form.Item>

          <div className={styles.formRow}>
            <Form.Item
              label="灾害类型"
              name="type"
              rules={[{ required: true, message: '请选择灾害类型' }]}
            >
              <Select options={typeOptions} />
            </Form.Item>
            <Form.Item
              label="风险等级"
              name="level"
              rules={[{ required: true, message: '请选择风险等级' }]}
            >
              <Select options={levelOptions} />
            </Form.Item>
          </div>

          <div className={styles.formRow}>
            <Form.Item
              label="预警状态"
              name="status"
              rules={[{ required: true, message: '请选择预警状态' }]}
            >
              <Select options={statusOptions} />
            </Form.Item>
            <Form.Item
              label="影响范围 (km)"
              name="radius"
              rules={[{ required: true, message: '请输入影响范围' }]}
            >
              <InputNumber min={0.5} max={500} step={0.5} className={styles.fullWidth} />
            </Form.Item>
          </div>

          <div className={styles.formRow}>
            <Form.Item label="中心点" name="centerText">
              <Input placeholder="示例：113.2644, 23.1291" />
            </Form.Item>
            <Form.Item label="发布人" name="publisher">
              <Input placeholder="发布人" />
            </Form.Item>
          </div>

          <Form.Item
            label="预警描述"
            name="description"
            rules={[{ required: true, message: '请输入预警描述' }]}
          >
            <TextArea rows={5} placeholder="请输入预警说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WarningList
