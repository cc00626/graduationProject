export const GUANGZHOU_DISTRICT_MAP = {
  LIWAN: '440103',
  YUEXIU: '440104',
  HAIZHU: '440105',
  TIANHE: '440106',
  BAIYUN: '440111',
  HUANGPU: '440112',
  PANYU: '440113',
  HUADU: '440114',
  NANSHA: '440115',
  CONGHUA: '440117',
  ZENGCHENG: '440118',
} as const

export const DISTRICT_NAME_TO_CODE: Record<string, string> = {
  '荔湾区': '440103',
  '越秀区': '440104',
  '海珠区': '440105',
  '天河区': '440106',
  '白云区': '440111',
  '黄埔区': '440112',
  '番禺区': '440113',
  '花都区': '440114',
  '南沙区': '440115',
  '从化区': '440117',
  '增城区': '440118',
}

export type DistrictName = keyof typeof DISTRICT_NAME_TO_CODE
export type DistrictCode = (typeof GUANGZHOU_DISTRICT_MAP)[keyof typeof GUANGZHOU_DISTRICT_MAP]

export const LAYERS = {
  DISTRICT: 'district',
  WATER: 'water',
  FLOOD_BUFFER: 'floodBuffer',
  RISK_POINTS: 'riskPoints',
  WIND_HEAT: 'windHeat',
} as const

export type LayerType = keyof typeof LAYERS
