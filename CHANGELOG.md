# Changelog

## 1.0.0

首个公开版本。

### 功能

- **侧边栏入口 + 整页看板**：注册在 `sidebar.panellist`（`id: dsh-usage-dashboard`, order 30）与 `main`（`key: dsh-usage-dashboard`），不替换任何既有槽位
- **读数条**：Token 总量（调用次数 + 缓存命中率）、今日 / 本月 / 历史累计费用、API 余额（充值 + 赠送，未登录/未启用/失败三种状态各有说明）
- **Token 构成**：堆叠比例条 + 四类计数（输入未命中缓存 / 输出 / 缓存命中 / 缓存写入）与占比
- **模型占比**：按 model id 聚合（跨 provider 合并），占比条 + Token 数 + 分模型费用，来源 provider 见 tooltip
- **使用趋势**：单调三次插值平滑曲线、面积渐变、悬浮十字线 + 当日明细卡、7/30/90/182 天切换、键盘 `←/→` 逐日
- **活跃热力图**：近 182 天逐日方格，DeepSeek 蓝色阶五档；悬停描边高亮 + 图例行原位明细（不遮挡网格）
- **双语**：中 / 英文案按宿主 locale 自动切换，`meta.title` / `meta.description` 同时提供 `zh.json` 与 `en.json`

### 数据

- 从 `assistant/message` 的 `data.usage` 与 `data.message.source` 聚合，只读会话日志
- 按 `SessionPersistenceSnapshot.revision` 增量缓存，冷读 ~800ms / 热读 ~25ms（10 会话 / 2180 次调用实测）

### 修正

- 模型统计按 model id 合并，修复同名模型因 provider 不同而重复成多行
- 钱包余额按金额格式化（provider 返回值带 16 位小数）
- 折线图命中判定改为按渲染像素换算，容器宽度与 viewBox 不一致时仍能选中指针下那一天
