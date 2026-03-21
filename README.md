# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

广州市地图资源 https://datav.aliyun.com/portal/school/atlas/area_selector

- 风速卡片效果
- 底图各个省高亮效果

1. 核心 GIS 分析功能（体现专业性）
   GIS 专业的系统不能只做数据展示（可视化），必须有“空间分析”：

缓冲区分析 (Buffer Analysis)： 当某个气象监测站发生预警（如强降雨）时，自动生成 5km/10km 的影响缓冲区，识别缓冲区内的关键基础设施（如学校、医院、地铁站）。

热力图分析： 根据广州市各区历史气象灾害发生的频率，生成灾害风险分布热力图，而不仅仅是简单的分级着色。

路径规划（避险）： 模拟发生灾害（如积水淹路）时，系统能计算出从当前位置到最近避难场所的最优路径，避开受灾严重的区域。

2. 气象灾害实时监测与预警
   针对你提到的“气象灾害”主题 ：

实时降水/气温等值线图： 通过后端获取广州各区实时数据，利用插值算法（如 IDW 反距离权重插值）生成全广州市的气温或降水分布等值线面。

多层图层切换： 增加雷达反射率图层、卫星云图图层（可以通过气象 API 获取 WMS 服务地址），让系统看起来更像专业气象站。

弹窗预警推送： 当后台 API 抓取到广州市气象局发布的“红色预警”时，前端地图自动跳转至该区域并弹出高亮闪烁提醒。

3. 数据管理与统计报表
   对应你侧边栏已有的“统计报表”项：

历史数据时序分析： 增加一个折线图，展示广州近 24 小时或近一周的温度、风力变化趋势 。

灾害数据导出： 允许管理员将选定区域、选定时间的灾害记录导出为 Excel 或 CSV 格式。

用户权限管理： 区分“普通用户”（仅查看）和“管理员”（编辑灾害点信息、发布通知） 。

4. 交互体验优化（视觉加分）
   鼠标悬浮监测点交互： 当鼠标滑过地图上的监测站或受灾点时，左侧或右侧弹出气泡框，展示实时气温、湿度、风级等详细数据。

底图自由切换： 提供影像图、矢量图、地形图、深色模式图层（Dark Mode 对可视化大屏非常加分）的自由切换。

🛠 技术选型补充建议
由于你使用了 Express ，如果要做更复杂的空间运算（如缓冲区），建议：

引入 Turf.js： 这是一个非常强大的前端 GIS 空间分析库，可以直接配合 Leaflet 处理地理要素运算，不用写复杂的后台算法。

PostGIS 数据库： 如果数据量大，建议将 MySQL 换成支持地理信息存储的 PostGIS。

气象灾害实时监测模块（数据层）
该模块主要解决你开题报告中提到的“实时展示”和“数据响应滞后”问题 。

多源天气实况看板： \* 通过高德或和风天气 API 抓取广州 11 个行政区的实时气温、湿度、降雨量、风向风速 。

气象灾害预警轮播： 实时抓取并展示广州市气象台发布的最新预警信号（如暴雨橙色预警、台风蓝色预警等）。

监测站分布交互：

在 Leaflet 地图上加载广州主要气象站点的坐标点（Marker）。

点击站点弹出 Popup，显示该站点的实时观测数据及近 24 小时气温变化折线图。

气象要素分级着色图（Choropleth Map）：

根据各区的实时气温或降水量，对行政区划 GeoJSON 进行动态着色（例如：降雨量越大，蓝色越深）。

2. GIS 空间分析与辅助决策模块（核心竞争力）
   这是体现你 WebGIS 专业性 的关键，用于解决你提到的“智能决策”功能 。

自动化缓冲区分析 (Buffer Analysis)：

触发机制： 当某一区域发生严重灾害预警（如暴雨红色预警）时，系统自动以该区中心或监测站为圆心生成 3km/5km/10km 的缓冲区。

风险因子识别： 自动筛选出落在缓冲区内的学校、医院、地铁站、危旧房屋等关键 POI，并列表展示。

积水点/内涝点路径分析：

在地图上标注广州著名的易涝点。

功能： 提供“避险路线”功能，用户输入起点和终点，系统利用路径算法避开已发布的内涝受灾区域。

灾害影响人口估算：

结合各区的常住人口数据，当某区受灾时，通过空间叠加分析，给出预计受影响的人口规模建议。

3. 历史灾害评估与统计报表模块（管理层）
   对应你截图中左侧导航栏的“统计报表”项。

灾害历史时空回溯：

提供时间轴组件（Time Slider），用户可以滑动查看过去 10 年广州市台风或暴雨灾害的发生轨迹和频率分布 。

可视化报表中心：

使用 Echarts 渲染广州各季度灾害分布饼图、各区灾害损失对比柱状图。

灾害数据管理：

支持管理员（陈久祥）在后台手动录入或编辑新的灾害实况信息 。

支持将统计结果导出为 PDF 或 Excel 报表。

4. 基础地图服务与交互模块
   优化你目前的系统界面，提升可视化体验 。

多源底图切换： 支持高德矢量地图、卫星影像图、地形图、以及深色（Dark Mode）气象主题地图的自由切换。

图层管理器： 允许用户自由勾选显示/隐藏“河流湖泊”、“行政边界”、“受灾点”、“避难场所”等图层。

全屏展示与测绘工具： 提供地图全屏缩放、距离测量、面积测量工具，方便应急人员估算受灾面积。
