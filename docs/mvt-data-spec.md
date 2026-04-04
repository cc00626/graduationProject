# 数据层升级规范（GeoJSON -> MVT）

## 1. 目标
- 从单文件 GeoJSON 渲染升级为矢量瓦片（MVT）分级加载。
- 支持大数据量、跨屏幕自适配和样式分层。

## 2. 分层模型
- `base_admin`：行政区边界（市/区/街道）。
- `risk_polygon`：风险区域面。
- `risk_point`：站点、告警点、传感器点。
- `risk_line`：路径、风场、巡检轨迹。

## 3. 服务接口（建议）
1. 元数据接口：
```http
GET /api/v1/map/tilesets/{tilesetId}/metadata
```
返回：
```json
{
  "tilesetId": "gz_risk_v1",
  "minZoom": 5,
  "maxZoom": 14,
  "tileSize": 512,
  "layers": ["base_admin", "risk_polygon", "risk_point", "risk_line"],
  "updatedAt": "2026-04-04T12:00:00Z",
  "version": "2026.04.04-1"
}
```

2. 瓦片接口：
```http
GET /api/v1/map/tiles/{tilesetId}/{z}/{x}/{y}.pbf
```
Headers：
- `Content-Type: application/vnd.mapbox-vector-tile`
- `Cache-Control: public, max-age=300, stale-while-revalidate=60`
- `ETag: "<tile-hash>"`

3. 业务风险快照接口（给图层赋值）：
```http
GET /api/v1/risk/snapshot?region=440100&time=2026-04-04T12:00:00Z
```
返回：
```json
{
  "time": "2026-04-04T12:00:00Z",
  "districts": [
    { "adcode": "440106", "riskLevel": 3, "riskScore": 82.1, "alertCount": 9 },
    { "adcode": "440111", "riskLevel": 2, "riskScore": 56.3, "alertCount": 4 }
  ],
  "stations": [
    { "id": "st_001", "riskLevel": 2, "status": "online", "value": 19143 },
    { "id": "st_002", "riskLevel": 3, "status": "online", "value": 27703 }
  ]
}
```

## 4. 字段规范（必须）
- 通用：`id`、`adcode`、`name`、`timestamp`、`version`。
- 风险字段：
  - `riskLevel`：`0-4` 整数。
  - `riskScore`：`0-100` 浮点。
  - `confidence`：`0-1` 浮点。
- 点位字段：
  - `status`：`online|offline|warning|error`。
  - `value`：监测值（number）。
  - `unit`：单位（string）。

## 5. 前端渲染规则（建议）
- `z < 8`：只显示市级边界和聚合点。
- `8 <= z < 11`：显示区级边界 + 重点点位。
- `z >= 11`：显示详细点、标签、告警范围。
- 对移动端：禁用高成本动画，启用点聚合。

## 6. 迁移步骤
1. 保留当前 GeoJSON 路径作为 fallback。
2. 新增 MVT source 和 layer（优先在 OpenLayers 中接入）。
3. 用快照接口覆盖样式字段（riskLevel、status）。
4. 稳定后再下线 GeoJSON 主链路。

## 7. 质量门禁
- 首屏地图加载 < 2s（同城网络）。
- 地图平移缩放 95 分位帧率 >= 30fps。
- 瓦片 5xx 错误率 < 0.1%。
- 样式版本和数据版本可追踪（日志带 version）。
