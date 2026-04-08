/**
 * 广州市各行政区 ADCode 映射表
 */
export const GUANGZHOU_DISTRICT_MAP = {
  /** 荔湾区 */
  LIWAN: '440103',
  /** 越秀区 */
  YUEXIU: '440104',
  /** 海珠区 */
  HAIZHU: '440105',
  /** 天河区 */
  TIANHE: '440106',
  /** 白云区 */
  BAIYUN: '440111',
  /** 黄埔区 */
  HUANGPU: '440112',
  /** 番禺区 */
  PANYU: '440113',
  /** 花都区 */
  HUADU: '440114',
  /** 南沙区 */
  NANSHA: '440115',
  /** 从化区 */
  CONGHUA: '440117',
  /** 增城区 - 注：根据通用编码补全，表格中未显示完整 */
  ZENGCHENG: '440118',
} as const

/**
 * 方便根据中文名查找代码的映射
 */
export const DISTRICT_NAME_TO_CODE: Record<string, string> = {
  荔湾区: '440103',
  越秀区: '440104',
  海珠区: '440105',
  天河区: '440106',
  白云区: '440111',
  黄埔区: '440112',
  番禺区: '440113',
  花都区: '440114',
  南沙区: '440115',
  从化区: '440117',
  增城区: '440118',
}

/**
 * 类型定义：限制只能使用上述定义的区名
 */
export type DistrictName = keyof typeof DISTRICT_NAME_TO_CODE
export type DistrictCode = (typeof GUANGZHOU_DISTRICT_MAP)[keyof typeof GUANGZHOU_DISTRICT_MAP]
