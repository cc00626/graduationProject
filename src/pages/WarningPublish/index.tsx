import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Result,
  Segmented,
  Select,
  Slider,
  Space,
  Tag,
  message,
} from 'antd'
import { BulbOutlined, FileDoneOutlined, HolderOutlined, SaveOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import type { BufferPoiItem } from '@/services/rain'
import { getTyphoonList, getTyphoonPath } from '@/services/typhoon'
import {
  createWarning,
  type WarningLevel,
  type WarningPayload,
  type WarningStatus,
  type WarningType,
} from '@/services/warning'
import { canManageWarnings, getUserPreferences, hasPermission } from '@/utils/auth'
import styles from './index.module.scss'

const { TextArea } = Input

type PanelKey = 'form' | 'preview'
type FormItemKey =
  | 'title'
  | 'location'
  | 'typeLevel'
  | 'template'
  | 'typhoonNo'
  | 'radiusPublisher'
  | 'description'
  | 'actions'

const defaultPanelOrder: PanelKey[] = ['form', 'preview']
const defaultFormItemOrder: FormItemKey[] = [
  'title',
  'location',
  'typeLevel',
  'template',
  'typhoonNo',
  'radiusPublisher',
  'description',
  'actions',
]
const formItemOrderStorageKey = 'warning-publish-form-item-order'

type SortablePanelProps = {
  id: PanelKey
  title: string
  hint: string
  cardClassName?: string
  panelClassName?: string
  children: ReactNode
}

type SortableFormItemProps = {
  id: FormItemKey
  label: string
  order: number
  children: ReactNode
}

const defenseAdviceTemplates: Record<WarningType, Record<WarningLevel, string[]>> = {
  typhoon: {
    low: [
      '密切关注台风路径变化，提前检查门窗、广告牌和临时构筑物。',
      '港口、码头和涉海单位加强值守，做好船只避风准备。',
      '提醒公众减少滨海游玩和不必要外出。',
    ],
    medium: [
      '学校、景区和大型活动单位视情况调整安排，落实人员避险措施。',
      '船只就近回港避风，海上作业人员及时撤离上岸。',
      '加固高空设施，暂停危险区域户外作业。',
    ],
    high: [
      '建议受影响区域采取停课、停工、停业等临时管控措施。',
      '所有船只立即回港避风，涉海人员全部上岸避险。',
      '停止高空、户外、临水和临边作业，转移危旧房、低洼地带人员。',
    ],
  },
  rain: {
    low: [
      '关注短时强降水变化，提醒公众携带雨具并避开积水路段。',
      '排水、交通和街镇值守人员加强巡查，提前清理雨水口杂物。',
      '学校、医院和地铁站点检查防滑、防渗和应急照明设施。',
    ],
    medium: [
      '加强低洼易涝点、下穿隧道、地下空间和河涌沿线巡查。',
      '视积水情况对重点路段实施临时交通疏导和限行提醒。',
      '通知地下车库、工地基坑和临水区域做好挡水、抽排和人员转移准备。',
    ],
    high: [
      '组织低洼地、危旧房、地下空间和山边水边人员提前转移避险。',
      '排水、城管和街镇队伍加密巡查泵站、涵洞、易涝点和河涌口。',
      '对严重积水、地质灾害隐患和视距受限路段发布交通管制提醒。',
    ],
  },
  flood: {
    low: [
      '关注河道水位和上游来水变化，提醒沿河单位做好巡查记录。',
      '检查闸泵、排水口和临河护栏，保持抢险物资可用。',
      '提醒公众远离河涌、漫水桥和临水平台。',
    ],
    medium: [
      '对临河低洼片区、地下空间和易涝小区提前布防。',
      '加强堤防、闸站、桥涵和排涝泵站巡查，发现险情立即上报。',
      '对涉水道路、桥洞和亲水区域设置警戒线并引导绕行。',
    ],
    high: [
      '立即组织低洼沿河、危旧房和受淹风险区域人员转移避险。',
      '加密巡查堤防、泵站、涵闸和排水主通道，抢险队伍前置待命。',
      '对漫水桥、积水涵洞和受淹道路实施交通管制，严禁人员涉水通行。',
    ],
  },
}

const typeNameMap: Record<WarningType, string> = {
  rain: '暴雨',
  flood: '洪水',
  typhoon: '台风',
}

const levelNameMap: Record<WarningLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

type TyphoonWarningState = {
  no: string
  name: string
  englishName: string
  warningLevel: 'blue' | 'yellow' | 'orange' | 'red'
  level: WarningLevel
  title: string
  location: string
  description: string
  analysis: WarningPayload['analysis']
}

type LocationState = {
  center?: number[]
  radius?: number
  analysis?: {
    count?: number
    avg?: number
    max?: number
    risk?: string
  }
  pois?: BufferPoiItem[]
  typhoonWarning?: TyphoonWarningState
}

type WarningFormValues = {
  title: string
  location: string
  type: WarningType
  level: WarningLevel
  radius: number
  description: string
  publisher?: string
  typhoonNo?: string
}

type TyphoonListItem = {
  no: string
  name: string
  englishName: string
  warningLevel: 'blue' | 'yellow' | 'orange' | 'red'
  center: number[]
  maxWindSpeed: number
  minPressure: number
}

type TyphoonPathPayload = {
  no: string
  name: string
  englishName: string
  center: number[]
  primaryPath: Array<{
    LON: number
    LAT: number
    WINDVELOCITY: number
    PRESS: number
    YYYYMMDDHHMM: string
    isForecast: boolean
    movement: string
    radius7: Record<string, number>
  }>
  impact: {
    landingRisk: string
    summary: string
    cities: Array<{
      city: string
      distanceKm: number
      nearestTime: string
      riskLevel: string
    }>
  }
  warning: {
    level: 'blue' | 'yellow' | 'orange' | 'red'
    issueTime: string
    affectedAreas: string[]
    defenseAdvice: string[]
  }
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

const typhoonLevelText = {
  blue: '蓝色预警',
  yellow: '黄色预警',
  orange: '橙色预警',
  red: '红色预警',
}

const levelColorMap: Record<WarningLevel, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
}

const labelOf = <T extends string>(options: Array<{ label: string; value: T }>, value?: T) =>
  options.find(item => item.value === value)?.label || '-'

const riskToLevel = (risk?: string): WarningLevel => {
  if (risk === '高风险' || risk === '高') return 'high'
  if (risk === '中风险' || risk === '中') return 'medium'
  return 'low'
}

const getDefenseAdvice = (type: WarningType, level: WarningLevel) =>
  defenseAdviceTemplates[type]?.[level] || []

const buildDefenseText = (type: WarningType, level: WarningLevel) =>
  getDefenseAdvice(type, level)
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n')

const buildWarningDescription = (
  type: WarningType,
  level: WarningLevel,
  context?: {
    location?: string
    radius?: number
    analysis?: LocationState['analysis']
    pois?: BufferPoiItem[]
    baseDescription?: string
  },
) => {
  const summaryParts = [
    `${typeNameMap[type]}${levelNameMap[level]}预警`,
    context?.location ? `影响区域：${context.location}` : '',
    context?.radius ? `影响半径：${context.radius}km` : '',
  ].filter(Boolean)

  const analysis = context?.analysis
  const rainSummary = analysis
    ? `监测分析：最大降雨${analysis.max ?? '-'}mm，平均降雨${analysis.avg ?? '-'}mm，命中雨区${analysis.count ?? 0}个，周边重点设施${context?.pois?.length ?? 0}个。`
    : ''

  const base = context?.baseDescription?.trim()
  const advice = buildDefenseText(type, level)

  return [
    summaryParts.join('，') + '。',
    rainSummary,
    base && !rainSummary ? base : '',
    '防御建议：',
    advice,
  ]
    .filter(Boolean)
    .join('\n')
}

const warningLevelToRisk = (level: TyphoonPathPayload['warning']['level']): WarningLevel => {
  if (level === 'red' || level === 'orange') return 'high'
  if (level === 'yellow') return 'medium'
  return 'low'
}

const normalizeFormItemOrder = (value: unknown): FormItemKey[] => {
  if (!Array.isArray(value)) return defaultFormItemOrder

  const nextOrder = value.filter((item): item is FormItemKey =>
    defaultFormItemOrder.includes(item as FormItemKey),
  )
  const missingItems = defaultFormItemOrder.filter(item => !nextOrder.includes(item))

  return [...nextOrder, ...missingItems]
}

const getInitialFormItemOrder = () => {
  if (typeof window === 'undefined') return defaultFormItemOrder

  try {
    return normalizeFormItemOrder(
      JSON.parse(window.localStorage.getItem(formItemOrderStorageKey) || '[]'),
    )
  } catch {
    return defaultFormItemOrder
  }
}

const SortablePanel = ({
  title,
  hint,
  cardClassName,
  panelClassName,
  children,
}: SortablePanelProps) => {
  return (
    <section className={[styles.sortablePanel, panelClassName].filter(Boolean).join(' ')}>
      <Card
        className={cardClassName}
        title={
          <div className={styles.panelTitle}>
            <div>
              <strong>{title}</strong>
              <span>{hint}</span>
            </div>
          </div>
        }
      >
        {children}
      </Card>
    </section>
  )
}

const SortableFormItem = ({ id, label, order, children }: SortableFormItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const itemStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    order,
  }

  return (
    <section
      ref={setNodeRef}
      style={itemStyle}
      className={[styles.sortableFormItem, isDragging ? styles.sortableFormItemDragging : '']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={styles.formItemDragHandle}
        aria-label={`Drag to reorder ${label}`}
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </button>
      <div className={styles.formItemContent}>{children}</div>
    </section>
  )
}

const WarningPublish = () => {
  const userPreferences = useMemo(() => getUserPreferences(), [])
  const canEditWarnings = canManageWarnings()
  const canCreateWarning = hasPermission('button:warning:create')
  const canPublishWarning = hasPermission('button:warning:publish')
  const [form] = Form.useForm<WarningFormValues>()
  const location = useLocation()
  const state = (location.state || {}) as LocationState
  const values = Form.useWatch([], form)
  const [submitting, setSubmitting] = useState(false)
  const [typhoonList, setTyphoonList] = useState<TyphoonListItem[]>([])
  const [linkedCenter, setLinkedCenter] = useState<number[] | undefined>(state.center)
  const [linkedAnalysis, setLinkedAnalysis] = useState<WarningPayload['analysis']>(
    state.typhoonWarning?.analysis || state.analysis || null,
  )
  const [linkedPois, setLinkedPois] = useState<BufferPoiItem[]>(state.pois || [])
  const [sourceMode, setSourceMode] = useState<'rain' | 'typhoon'>(
    state.typhoonWarning ? 'typhoon' : 'rain',
  )
  const [formItemOrder, setFormItemOrder] = useState<FormItemKey[]>(getInitialFormItemOrder)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const selectedType = Form.useWatch('type', form)
  const selectedLevel = Form.useWatch('level', form)

  const initialDescription = useMemo(() => {
    if (state.typhoonWarning) return state.typhoonWarning.description
    if (!state.analysis) return ''

    const level = riskToLevel(state.analysis.risk)
    return buildWarningDescription('rain', level, {
      radius: state.radius || 5,
      analysis: state.analysis,
      pois: state.pois,
    })
  }, [state.analysis, state.pois, state.radius, state.typhoonWarning])

  useEffect(() => {
    const loadTyphoonList = async () => {
      const res = (await getTyphoonList()) as { data?: TyphoonListItem[] } | null
      if (res?.data) setTyphoonList(res.data)
    }
    void loadTyphoonList()
  }, [])

  useEffect(() => {
    form.setFieldsValue({
      title: state.typhoonWarning
        ? state.typhoonWarning.title
        : state.analysis
          ? `${state.analysis.risk || '低风险'}区域预警`
          : '气象灾害预警',
      location:
        state.typhoonWarning?.location ||
        (state.center
          ? `${state.center[0]}, ${state.center[1]}`
          : userPreferences.defaultDistrict === '全市'
            ? undefined
            : userPreferences.defaultDistrict),
      radius: state.radius || 5,
      level: state.typhoonWarning?.level || riskToLevel(state.analysis?.risk),
      type: state.typhoonWarning ? 'typhoon' : 'rain',
      publisher: '管理员',
      description: initialDescription,
      typhoonNo: state.typhoonWarning?.no,
    })
  }, [
    form,
    initialDescription,
    state.analysis,
    state.center,
    state.radius,
    state.typhoonWarning,
    userPreferences.defaultDistrict,
  ])

  useEffect(() => {
    if (selectedType === 'typhoon') {
      setSourceMode('typhoon')
    } else if (selectedType === 'rain' || selectedType === 'flood') {
      setSourceMode('rain')
    }
  }, [selectedType])

  useEffect(() => {
    window.localStorage.setItem(formItemOrderStorageKey, JSON.stringify(formItemOrder))
  }, [formItemOrder])

  const applyTyphoonData = async (no: string) => {
    const data = (await getTyphoonPath(no)) as TyphoonPathPayload | null
    if (!data?.primaryPath?.length) {
      message.error('台风路径数据加载失败')
      return
    }

    const latest = data.primaryPath[data.primaryPath.length - 1]
    const radius = Math.min(Math.max(...Object.values(latest.radius7 || { ne: 100 })), 500)
    const level = warningLevelToRisk(data.warning.level)
    const cityText = data.impact.cities
      .map(city => `${city.city}最近距离约${city.distanceKm}km，${city.riskLevel}风险`)
      .join('；')
    const description = [
      `${data.name}（${data.englishName}）中心位于${Number(latest.LON).toFixed(1)}E、${Number(latest.LAT).toFixed(1)}N，最大风速${latest.WINDVELOCITY}m/s，中心气压${latest.PRESS}hPa。`,
      `7级风圈半径约${radius}km，${data.impact.summary}`,
      cityText,
      `防御建议：${data.warning.defenseAdvice.join('；')}。`,
    ].join('\n')

    setLinkedCenter([Number(latest.LON), Number(latest.LAT)])
    setLinkedAnalysis({
      typhoonNo: data.no,
      typhoonName: `${data.name} ${data.englishName}`,
      risk: `${data.impact.landingRisk}风险`,
      landingRisk: data.impact.landingRisk,
      windSpeed: latest.WINDVELOCITY,
      pressure: latest.PRESS,
      movement: latest.movement,
      cities: data.impact.cities,
      warning: data.warning,
    })
    setLinkedPois([])
    form.setFieldsValue({
      typhoonNo: data.no,
      type: 'typhoon',
      title: `${data.name}${typhoonLevelText[data.warning.level]}`,
      location: data.warning.affectedAreas.join('、'),
      radius,
      level,
      description,
    })
    message.success('已同步台风路径与影响分析')
  }

  const handleSourceModeChange = (value: string | number) => {
    const mode = value as 'rain' | 'typhoon'
    setSourceMode(mode)

    if (mode === 'typhoon') {
      form.setFieldsValue({
        type: 'typhoon',
        title: values?.title === '气象灾害预警' ? '台风预警' : values?.title,
      })
      return
    }

    form.setFieldsValue({
      type: 'rain',
      typhoonNo: undefined,
      title: state.analysis ? `${state.analysis.risk || '低风险'}区域预警` : '降水灾害预警',
      location: state.center ? `${state.center[0]}, ${state.center[1]}` : values?.location,
      radius: state.radius || values?.radius || 5,
      level: riskToLevel(state.analysis?.risk),
      description:
        state.analysis && !state.typhoonWarning ? initialDescription : values?.description,
    })
    setLinkedCenter(state.center)
    setLinkedAnalysis(state.analysis || null)
    setLinkedPois(state.pois || [])
  }

  const currentAdvice = getDefenseAdvice(selectedType || 'rain', selectedLevel || 'low')

  const applyAdviceTemplate = () => {
    const formValues = form.getFieldsValue()
    const type = formValues.type || 'rain'
    const level = formValues.level || 'low'
    const locationText =
      formValues.location || (state.center ? `${state.center[0]}, ${state.center[1]}` : undefined)

    const description = buildWarningDescription(type, level, {
      location: locationText,
      radius: formValues.radius || state.radius || 5,
      analysis: type === 'typhoon' ? undefined : state.analysis,
      pois: type === 'typhoon' ? [] : state.pois,
      baseDescription: formValues.description,
    })

    form.setFieldsValue({
      title: formValues.title || `${typeNameMap[type]}${levelNameMap[level]}预警`,
      description,
    })
    message.success('已生成防御建议模板')
  }

  const handleFormItemDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    setFormItemOrder(current => {
      const oldIndex = current.indexOf(active.id as FormItemKey)
      const newIndex = current.indexOf(over.id as FormItemKey)

      if (oldIndex < 0 || newIndex < 0) return current
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  const resetFormItemOrder = () => {
    setFormItemOrder(defaultFormItemOrder)
    message.success('已恢复表单默认顺序')
  }

  const buildPayload = (formValues: WarningFormValues, status: WarningStatus): WarningPayload => ({
    title: formValues.title,
    location: formValues.location,
    type: formValues.type,
    level: formValues.level,
    radius: formValues.radius,
    description: formValues.description,
    publisher: formValues.publisher,
    status,
    center: linkedCenter,
    analysis: linkedAnalysis,
    pois: linkedPois,
  })

  const submitWarning = async (status: WarningStatus) => {
    const formValues = await form.validateFields()
    const payload = buildPayload(formValues, status)

    setSubmitting(true)
    try {
      const res = await createWarning(payload)
      if (res.code === 0) {
        message.success(res.message)
        return
      }

      message.error(res.message)
    } catch {
      message.error('预警保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const visibleFormItemOrder = formItemOrder.filter(
    item => sourceMode === 'typhoon' || item !== 'typhoonNo',
  )
  const getFormItemOrder = (id: FormItemKey) => visibleFormItemOrder.indexOf(id)

  const panelMap: Record<PanelKey, ReactNode> = {
    form: (
      <SortablePanel
        id="form"
        title="预警信息填写"
        hint="填写发布要素、生成防御建议并保存草稿"
        cardClassName={styles.formCard}
      >
        <Form form={form} layout="vertical">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFormItemDragEnd}
          >
            <SortableContext items={visibleFormItemOrder} strategy={rectSortingStrategy}>
              <div className={styles.formItemList}>
                <SortableFormItem id="title" label="title" order={getFormItemOrder('title')}>
                  <Form.Item
                    label="预警标题"
                    name="title"
                    rules={[{ required: true, message: '请输入预警标题' }]}
                  >
                    <Input placeholder="请输入预警标题" />
                  </Form.Item>
                </SortableFormItem>

                <SortableFormItem
                  id="location"
                  label="location"
                  order={getFormItemOrder('location')}
                >
                  <Form.Item
                    label="预警地点"
                    name="location"
                    rules={[{ required: true, message: '请输入预警地点' }]}
                  >
                    <Input placeholder="经纬度或地点名称" />
                  </Form.Item>
                </SortableFormItem>

                <SortableFormItem
                  id="typeLevel"
                  label="type and level"
                  order={getFormItemOrder('typeLevel')}
                >
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
                </SortableFormItem>

                <SortableFormItem
                  id="template"
                  label="template"
                  order={getFormItemOrder('template')}
                >
                  <div className={styles.templateBar}>
                    <div>
                      <strong>防御建议模板</strong>
                      <span>
                        根据当前类型和风险等级生成发布文案，暴雨高风险会自动补齐低洼转移、排水巡查和交通管制提醒。
                      </span>
                    </div>
                    <Button icon={<BulbOutlined />} onClick={applyAdviceTemplate}>
                      一键生成防御建议
                    </Button>
                  </div>
                </SortableFormItem>

                {sourceMode === 'typhoon' && (
                  <SortableFormItem
                    id="typhoonNo"
                    label="typhoon path"
                    order={getFormItemOrder('typhoonNo')}
                  >
                    <Form.Item label="关联台风路径" name="typhoonNo">
                      <Select
                        allowClear
                        placeholder="选择台风后自动生成预警内容"
                        options={typhoonList.map(item => ({
                          label: `${item.no} ${item.name} ${item.englishName}`,
                          value: item.no,
                        }))}
                        onChange={value => {
                          if (value) void applyTyphoonData(value)
                        }}
                      />
                    </Form.Item>
                  </SortableFormItem>
                )}

                <SortableFormItem
                  id="radiusPublisher"
                  label="radius and publisher"
                  order={getFormItemOrder('radiusPublisher')}
                >
                  <div className={styles.formRow}>
                    <Form.Item
                      label="影响范围 (km)"
                      name="radius"
                      rules={[{ required: true, message: '请设置影响范围' }]}
                    >
                      <Slider min={0.5} max={500} step={0.5} />
                    </Form.Item>

                    <Form.Item label="发布人" name="publisher">
                      <Input placeholder="发布人" />
                    </Form.Item>
                  </div>
                </SortableFormItem>

                <SortableFormItem
                  id="description"
                  label="description"
                  order={getFormItemOrder('description')}
                >
                  <Form.Item
                    label="预警描述"
                    name="description"
                    rules={[{ required: true, message: '请输入预警描述' }]}
                  >
                    <TextArea rows={6} placeholder="请输入预警说明" />
                  </Form.Item>
                </SortableFormItem>

                <SortableFormItem id="actions" label="actions" order={getFormItemOrder('actions')}>
                  <Space>
	                    <Button
	                      icon={<SaveOutlined />}
	                      loading={submitting}
	                      disabled={!canCreateWarning}
	                      onClick={() => void submitWarning('draft')}
                    >
                      保存草稿
                    </Button>
                    <Button
	                      type="primary"
	                      icon={<FileDoneOutlined />}
	                      loading={submitting}
	                      disabled={!canPublishWarning}
	                      onClick={() => void submitWarning('published')}
                    >
                      发布预警
                    </Button>
                  </Space>
                </SortableFormItem>
              </div>
            </SortableContext>
          </DndContext>
        </Form>
      </SortablePanel>
    ),
    preview: (
      <SortablePanel
        id="preview"
        title="预警预览"
        hint="实时核对发布内容和建议模板"
        cardClassName={styles.previewCard}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="标题">{values?.title || '-'}</Descriptions.Item>
          <Descriptions.Item label="地点">{values?.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color="blue">{labelOf(typeOptions, values?.type)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="等级">
            {values?.level ? (
              <Tag color={levelColorMap[values.level]}>{labelOf(levelOptions, values.level)}</Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="半径">{values?.radius || 0} km</Descriptions.Item>
          <Descriptions.Item label="中心点">
            {linkedCenter ? linkedCenter.map(item => item.toFixed(3)).join(', ') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="关联分析">
            {selectedType === 'typhoon'
              ? String(linkedAnalysis?.typhoonName || linkedAnalysis?.risk || '-')
              : `${state.analysis?.max ?? '-'} mm / ${state.pois?.length ?? 0} 个设施`}
          </Descriptions.Item>
        </Descriptions>
        <div className={styles.previewText}>{values?.description || '暂无预警描述'}</div>
        <div className={styles.advicePreview}>
          <div className={styles.adviceTitle}>当前建议模板</div>
          {currentAdvice.map(item => (
            <div key={item} className={styles.adviceItem}>
              {item}
            </div>
          ))}
        </div>
      </SortablePanel>
    ),
  }

  if (!canEditWarnings) {
    return (
      <Result
        status="403"
        title="无权设置预警"
        subTitle="当前角色为普通用户，只能查看监测与预警信息，不能新增、发布或修改预警。"
      />
    )
  }

  return (
    <div className={styles.page}>
      <Card className={styles.unifiedHeader}>
        <div className={styles.headerContent}>
          <div>
            <h2>统一预警发布中心</h2>
            <p>降水、洪涝和台风预警共用同一套发布流程，监测页面的分析结果会自动带入表单。</p>
          </div>
          <Segmented
            value={sourceMode}
            options={[
              { label: '降水 / 洪涝', value: 'rain' },
              { label: '台风', value: 'typhoon' },
            ]}
            onChange={handleSourceModeChange}
          />
          <Button onClick={resetFormItemOrder}>恢复表单顺序</Button>
        </div>
        <Alert
          type={sourceMode === 'typhoon' ? 'warning' : 'info'}
          showIcon
          message={
            sourceMode === 'typhoon'
              ? '选择关联台风后，将自动同步路径点、风圈半径、城市影响分析和防御建议。'
              : '从降水监测页进入时，将自动同步缓冲区中心、影响半径、降雨统计和周边设施。'
          }
        />
      </Card>

      <section className={styles.sortableGrid}>
        {defaultPanelOrder.map(panelKey => panelMap[panelKey])}
      </section>
    </div>
  )
}

export default WarningPublish
