import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
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
import {
  BulbOutlined,
  FileDoneOutlined,
  HolderOutlined,
  RadarChartOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import type { BufferPoiItem } from '@/services/rain'
import { generateWarningDraft } from '@/services/ai'
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
const warningDraftStorageKey = 'warning-publish-local-draft'
const warningChangedEvent = 'warning-published-updated'

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
  temperature: {
    low: [
      '关注高温天气变化，提醒公众减少午后长时间户外活动。',
      '学校、养老机构和户外作业单位做好防暑降温和补水提醒。',
      '加强电力、供水和医疗急救保障，关注重点人群健康状况。',
    ],
    medium: [
      '建议户外作业单位调整高温时段作业安排，落实轮换休息和防暑物资。',
      '提醒公众避免午后高温时段剧烈运动，老人、儿童和慢性病患者减少外出。',
      '加强城市运行保障，关注用电负荷、供水压力和中暑救治准备。',
    ],
    high: [
      '对露天作业、建筑工地和大型户外活动采取限时、暂停或错峰措施。',
      '组织社区、学校、养老机构加强重点人群巡查，及时处置中暑和热射病风险。',
      '电力、供水、医疗和应急部门加强值守，做好持续高温下的保障和救援准备。',
    ],
  },
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
  temperature: '高温',
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
  source?: 'rain' | 'typhoon' | 'temperature'
  center?: number[]
  radius?: number
  analysis?: {
    count?: number
    avg?: number
    max?: number
    risk?: string
    min?: number
    hotCount?: number
    threshold?: number
    source?: string
    location?: string
    stations?: unknown[]
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

type LocalWarningDraft = Partial<WarningFormValues> & {
  sourceMode?: 'rain' | 'typhoon' | 'temperature'
  linkedCenter?: number[]
  linkedAnalysis?: WarningPayload['analysis']
  linkedPois?: BufferPoiItem[]
  savedAt?: string
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
  { label: '高温', value: 'temperature' },
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
  const temperatureSummary =
    type === 'temperature' && analysis
      ? `监测分析：最高温度${analysis.max ?? '-'}°C，平均温度${analysis.avg ?? '-'}°C，最低温度${analysis.min ?? '-'}°C，达到高温阈值站点${analysis.hotCount ?? analysis.count ?? 0}个。`
      : ''
  const rainSummary = analysis
    ? `监测分析：最大降雨${analysis.max ?? '-'}mm，平均降雨${analysis.avg ?? '-'}mm，命中雨区${analysis.count ?? 0}个，周边重点设施${context?.pois?.length ?? 0}个。`
    : ''

  const base = context?.baseDescription?.trim()
  const advice = buildDefenseText(type, level)

  return [
    summaryParts.join('，') + '。',
    temperatureSummary || rainSummary,
    base && !(temperatureSummary || rainSummary) ? base : '',
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

const getLocalWarningDraft = (): LocalWarningDraft | null => {
  if (typeof window === 'undefined') return null

  try {
    const draft = JSON.parse(window.localStorage.getItem(warningDraftStorageKey) || 'null')
    return draft && typeof draft === 'object' ? draft : null
  } catch {
    return null
  }
}

const saveLocalWarningDraft = (draft: LocalWarningDraft) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    warningDraftStorageKey,
    JSON.stringify({
      ...draft,
      savedAt: new Date().toISOString(),
    }),
  )
}

const clearLocalWarningDraft = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(warningDraftStorageKey)
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
    transform: CSS.Translate.toString(transform),
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
  const navigate = useNavigate()
  const state = (location.state || {}) as LocationState
  const values = Form.useWatch([], form)
  const [submitting, setSubmitting] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState(() => getLocalWarningDraft()?.savedAt)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [typhoonList, setTyphoonList] = useState<TyphoonListItem[]>([])
  const [linkedCenter, setLinkedCenter] = useState<number[] | undefined>(state.center)
  const [linkedAnalysis, setLinkedAnalysis] = useState<WarningPayload['analysis']>(
    state.typhoonWarning?.analysis || state.analysis || null,
  )
  const [linkedPois, setLinkedPois] = useState<BufferPoiItem[]>(state.pois || [])
  const [sourceMode, setSourceMode] = useState<'rain' | 'typhoon' | 'temperature'>(
    state.source === 'temperature' ? 'temperature' : state.typhoonWarning ? 'typhoon' : 'rain',
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
  const hasIncomingWarningContext = Boolean(
    state.source || state.center || state.analysis || state.typhoonWarning,
  )

  const initialDescription = useMemo(() => {
    if (state.typhoonWarning) return state.typhoonWarning.description
    if (state.source === 'temperature' && state.analysis) {
      return buildWarningDescription('temperature', riskToLevel(state.analysis.risk), {
        radius: state.radius || 5,
        analysis: state.analysis,
        baseDescription: `监测来源：${state.analysis.source || '温度监测'}。`,
      })
    }
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
    const localDraft = hasIncomingWarningContext ? null : getLocalWarningDraft()
    const initialValues: Partial<WarningFormValues> = {
      title: state.typhoonWarning
        ? state.typhoonWarning.title
        : state.source === 'temperature'
          ? `${state.analysis?.risk || '高温'}区域预警`
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
      type: state.typhoonWarning
        ? 'typhoon'
        : state.source === 'temperature'
          ? 'temperature'
          : 'rain',
      publisher: '管理员',
      description: initialDescription,
      typhoonNo: state.typhoonWarning?.no,
    }

    form.setFieldsValue({
      ...initialValues,
      ...localDraft,
    })

    if (localDraft) {
      if (localDraft.sourceMode) setSourceMode(localDraft.sourceMode)
      setLinkedCenter(localDraft.linkedCenter)
      setLinkedAnalysis(localDraft.linkedAnalysis || null)
      setLinkedPois(localDraft.linkedPois || [])
      setDraftSavedAt(localDraft.savedAt)
      message.info('已恢复本地草稿')
    }
  }, [
    form,
    hasIncomingWarningContext,
    initialDescription,
    state.analysis,
    state.center,
    state.radius,
    state.source,
    state.typhoonWarning,
    userPreferences.defaultDistrict,
  ])

  useEffect(() => {
    if (selectedType === 'typhoon') {
      setSourceMode('typhoon')
    } else if (selectedType === 'temperature') {
      setSourceMode('temperature')
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
    const mode = value as 'rain' | 'typhoon' | 'temperature'
    setSourceMode(mode)

    if (mode === 'typhoon') {
      form.setFieldsValue({
        type: 'typhoon',
        title: values?.title === '气象灾害预警' ? '台风预警' : values?.title,
      })
      return
    }

    if (mode === 'temperature') {
      form.setFieldsValue({
        type: 'temperature',
        typhoonNo: undefined,
        title:
          state.source === 'temperature'
            ? `${state.analysis?.risk || '高温'}区域预警`
            : '高温天气预警',
        location: state.center ? `${state.center[0]}, ${state.center[1]}` : values?.location,
        radius: state.radius || values?.radius || 5,
        level: riskToLevel(state.analysis?.risk),
        description: state.source === 'temperature' ? initialDescription : values?.description,
      })
      setLinkedCenter(state.center)
      setLinkedAnalysis(state.source === 'temperature' ? state.analysis || null : null)
      setLinkedPois([])
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

  const generateAiWarningDraft = async () => {
    const formValues = form.getFieldsValue()
    const type = formValues.type || 'rain'
    const level = formValues.level || 'low'
    const locationText =
      formValues.location || (linkedCenter ? linkedCenter.join(', ') : state.center?.join(', '))

    setAiGenerating(true)
    try {
      const res = await generateWarningDraft({
        title: formValues.title,
        type,
        level,
        location: locationText,
        radius: formValues.radius || state.radius || 5,
        publisher: formValues.publisher,
        analysis: linkedAnalysis,
        pois: linkedPois,
        baseDescription: formValues.description,
      })

      if (res.code === 0) {
        form.setFieldsValue({
          title: formValues.title || `${typeNameMap[type]}${levelNameMap[level]}预警`,
          description: res.data.content,
        })
        message.success(`${res.message}：${res.data.model}`)
        return
      }

      message.error(res.message)
    } catch (error) {
      console.error('AI warning draft failed:', error)
      message.error('AI 预警文案生成失败，请检查后端 LLM 配置')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleFormItemDragChange = ({ active, over }: DragEndEvent | DragOverEvent) => {
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

  const openLinkedTyphoonTrack = () => {
    const typhoonNo = form.getFieldValue('typhoonNo') || state.typhoonWarning?.no
    navigate('/monitor/typhoon', {
      state: typhoonNo ? { typhoonNo } : undefined,
    })
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

  const persistLocalDraft = (formValues: Partial<WarningFormValues>) => {
    saveLocalWarningDraft({
      ...formValues,
      sourceMode,
      linkedCenter,
      linkedAnalysis,
      linkedPois,
    })
    setDraftSavedAt(new Date().toISOString())
  }

  const isDraftReadyForServer = (formValues: Partial<WarningFormValues>) =>
    Boolean(
      formValues.title &&
      formValues.location &&
      formValues.type &&
      formValues.level &&
      formValues.radius &&
      formValues.description,
    )

  const submitWarning = async (status: WarningStatus) => {
    if (status === 'draft') {
      const formValues = form.getFieldsValue(true)
      persistLocalDraft(formValues)

      if (!isDraftReadyForServer(formValues)) {
        message.success('草稿已保存到本地，补全必填内容后可同步到预警列表')
        return
      }

      setSubmitting(true)
      try {
        const res = await createWarning(buildPayload(formValues as WarningFormValues, status))
        if (res.code === 0) {
          message.success('草稿已保存，并已同步到预警列表')
          return
        }

        message.warning(res.message || '本地草稿已保存，同步列表失败')
      } catch {
        message.warning('本地草稿已保存，同步列表失败')
      } finally {
        setSubmitting(false)
      }
      return
    }

    const formValues = await form.validateFields()
    const payload = buildPayload(formValues, status)

    setSubmitting(true)
    try {
      const res = await createWarning(payload)
      if (res.code === 0) {
        message.success(res.message)
        if (status === 'published') {
          clearLocalWarningDraft()
          setDraftSavedAt(undefined)
          window.dispatchEvent(new Event(warningChangedEvent))
        }
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
  const draggableFormItemOrder = visibleFormItemOrder.filter(item => item !== 'actions')
  const getFormItemOrder = (id: FormItemKey) => visibleFormItemOrder.indexOf(id)

  const previewItemMap: Record<FormItemKey, ReactNode> = {
    title: (
      <div className={styles.previewItem}>
        <div className={styles.previewItemTitle}>预警标题</div>
        <div className={styles.previewValue}>{values?.title || '-'}</div>
      </div>
    ),
    location: (
      <div className={styles.previewItem}>
        <div className={styles.previewItemTitle}>预警地点</div>
        <div className={styles.previewValue}>{values?.location || '-'}</div>
        <div className={styles.previewSubValue}>
          中心点：{linkedCenter ? linkedCenter.map(item => item.toFixed(3)).join(', ') : '-'}
        </div>
      </div>
    ),
    typeLevel: (
      <div className={styles.previewItem}>
        <div className={styles.previewMetaGrid}>
          <div>
            <div className={styles.previewItemTitle}>灾害类型</div>
            <Tag color="blue">{labelOf(typeOptions, values?.type)}</Tag>
          </div>
          <div>
            <div className={styles.previewItemTitle}>风险等级</div>
            {values?.level ? (
              <Tag color={levelColorMap[values.level]}>{labelOf(levelOptions, values.level)}</Tag>
            ) : (
              '-'
            )}
          </div>
        </div>
      </div>
    ),
    template: (
      <div className={styles.advicePreview}>
        <div className={styles.adviceTitle}>当前建议模板</div>
        {currentAdvice.map(item => (
          <div key={item} className={styles.adviceItem}>
            {item}
          </div>
        ))}
      </div>
    ),
    typhoonNo: (
      <div className={styles.previewItem}>
        <div className={styles.previewItemTitle}>关联台风路径</div>
        <div className={styles.previewValue}>
          {String(linkedAnalysis?.typhoonName || values?.typhoonNo || '-')}
        </div>
        <div className={styles.previewSubValue}>
          {selectedType === 'typhoon'
            ? String(linkedAnalysis?.risk || linkedAnalysis?.movement || '-')
            : '-'}
        </div>
      </div>
    ),
    radiusPublisher: (
      <div className={styles.previewItem}>
        <div className={styles.previewMetaGrid}>
          <div>
            <div className={styles.previewItemTitle}>影响半径</div>
            <div className={styles.previewValue}>{values?.radius || 0} km</div>
          </div>
          <div>
            <div className={styles.previewItemTitle}>发布人</div>
            <div className={styles.previewValue}>{values?.publisher || '-'}</div>
          </div>
        </div>
        <div className={styles.previewSubValue}>
          关联分析：
          {selectedType === 'typhoon'
            ? String(linkedAnalysis?.typhoonName || linkedAnalysis?.risk || '-')
            : `${linkedAnalysis?.max ?? '-'} mm / ${linkedPois.length} 个设施`}
        </div>
      </div>
    ),
    description: (
      <div className={styles.previewItem}>
        <div className={styles.previewItemTitle}>预警描述</div>
        <div className={styles.previewText}>{values?.description || '暂无预警描述'}</div>
      </div>
    ),
    actions: (
      <div className={styles.previewItem}>
        <div className={styles.previewItemTitle}>发布操作</div>
        <Space wrap>
          <Tag color={canCreateWarning ? 'green' : 'default'}>保存草稿</Tag>
          <Tag color={canPublishWarning ? 'blue' : 'default'}>发布预警</Tag>
        </Space>
      </div>
    ),
  }

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
            onDragEnd={handleFormItemDragChange}
          >
            <SortableContext items={draggableFormItemOrder} strategy={rectSortingStrategy}>
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
                  <div className={styles.aiTemplateCard}>
                    <div className={styles.aiTemplateHeader}>
                      <div>
                        <strong>AI 预警文案助手</strong>
                        <span>
                          根据灾害类型、风险等级、影响区域和监测分析自动生成结构化预警正文。
                        </span>
                      </div>
                      <Tag
                        color={
                          sourceMode === 'typhoon'
                            ? 'orange'
                            : sourceMode === 'temperature'
                              ? 'red'
                              : 'blue'
                        }
                      >
                        {sourceMode === 'typhoon'
                          ? '台风路径联动'
                          : sourceMode === 'temperature'
                            ? '温度监测联动'
                            : '降水分析联动'}
                      </Tag>
                    </div>
                    <div className={styles.aiPromptGrid}>
                      <div>
                        <span>生成依据</span>
                        <b>{labelOf(typeOptions, selectedType || values?.type || 'rain')}</b>
                      </div>
                      <div>
                        <span>风险等级</span>
                        <b>{labelOf(levelOptions, selectedLevel || values?.level || 'low')}</b>
                      </div>
                      <div>
                        <span>关联数据</span>
                        <b>
                          {sourceMode === 'typhoon'
                            ? String(linkedAnalysis?.typhoonName || values?.typhoonNo || '待选择')
                            : sourceMode === 'temperature'
                              ? `${linkedAnalysis?.max ?? '-'}°C / ${linkedAnalysis?.hotCount ?? linkedAnalysis?.count ?? 0}个高温站点`
                              : `${linkedAnalysis?.max ?? '-'}mm / ${linkedPois.length}个设施`}
                        </b>
                      </div>
                    </div>
                    <Space wrap className={styles.aiActionRow}>
                      <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={aiGenerating}
                        onClick={() => void generateAiWarningDraft()}
                      >
                        AI 生成预警正文
                      </Button>
                      <Button icon={<BulbOutlined />} onClick={applyAdviceTemplate}>
                        仅生成防御建议
                      </Button>
                    </Space>
                  </div>
                </SortableFormItem>

                {sourceMode === 'typhoon' && (
                  <SortableFormItem
                    id="typhoonNo"
                    label="typhoon path"
                    order={getFormItemOrder('typhoonNo')}
                  >
                    <div className={styles.formRow}>
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
                      <Form.Item label="路径联动">
                        <Button icon={<RadarChartOutlined />} onClick={openLinkedTyphoonTrack}>
                          查看台风路径
                        </Button>
                      </Form.Item>
                    </div>
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
              </div>
            </SortableContext>
          </DndContext>
          <div className={styles.fixedActionRow}>
            <div className={styles.draftStatus}>
              {draftSavedAt
                ? `本地草稿已保存：${new Date(draftSavedAt).toLocaleString()}`
                : '草稿会保存在本地，重新进入可继续编辑'}
            </div>
            <Space wrap>
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
          </div>
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
        <div className={styles.previewItemList}>
          {[...draggableFormItemOrder, 'actions' as const].map(item => (
            <div key={item} className={styles.previewSortableItem}>
              {previewItemMap[item]}
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
              { label: '高温', value: 'temperature' },
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
              : sourceMode === 'temperature'
                ? '从温度监测页进入时，将自动同步高温站点、平均温度、最高温度和影响范围。'
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
