# DSH 用量看板 · dsh-usage-dashboard

DeepSeek Harness 的桌面端用量可视化看板插件。侧边栏一个图标，点开就是一整页的 Token 用量、费用估算、账户余额、使用趋势和模型占比 —— 所有数字都从你自己的会话日志里实时算出来。

![用量看板](docs/screenshot.png)

## 功能

| 区域 | 内容 |
|---|---|
| **读数条** | Token 总量（含调用次数与缓存命中率）、今日费用、本月费用、历史累计费用、API 余额（充值钱包 + 赠送额度；未登录时显示状态而不是报错） |
| **Token 构成** | 堆叠比例条 + 明细表：输入（未命中缓存）/ 输出 / 缓存命中 / 缓存写入，各自数量与占比，底部给出缓存命中率 |
| **模型占比** | 按总 Token 排序的模型份额条，含 Token 数与各模型费用；同一模型跨多个 provider 会自动合并，悬停可看来源 |
| **使用趋势** | 平滑折线（单调三次插值，零用量日不会被画到基线以下）+ 悬浮十字线 + 当日明细卡片；7 / 30 / 90 / 182 天可切换，`←` `→` 逐日移动 |
| **活跃热力图** | 近半年逐日方格，颜色越深用量越大；悬停格子会描边高亮，并在下方图例行原位显示当天明细（浮层不会遮挡网格） |

折线与热力图统一使用 DeepSeek 蓝配色阶 `#dff2fe → #a0dcfd → #60b3fe → #0c70f3`；其余结构与控件全部沿用宿主主题 token（`--dsw-alias-*`），亮色/暗色自动跟随。

## 安装

### 安装后长什么样

- 侧边栏底部、设置上方，多出一个柱状图图标
- 点击它，中栏整页变成看板
- 插件管理页里能看到「用量看板」条目及其图标

### 环境要求

- DeepSeek Harness Desktop 0.2.x
- Node.js `>= 20`

### 安装方式

**方式一：本地目录安装（推荐，改代码即时生效）**

```bash
git clone https://github.com/JeffKeeping/dsh-usage-dashboard.git
```

然后在 Harness 里执行（把路径换成你的实际克隆路径）：

```
plugin_manager action=install_bundle target=<绝对路径>/dsh-usage-dashboard
```

或用 CLI：

```bash
dsh plugin install <绝对路径>/dsh-usage-dashboard
```

安装立即生效。若界面还没出现新的侧边栏图标，按 `Ctrl+R` 刷新一次窗口（客户端代码是模块化加载的，刷新后才换成磁盘上的最新版本）。

**方式二：从 npm 安装**

```bash
dsh plugin install dsh-usage-dashboard
```

### 验证安装

```bash
curl http://127.0.0.1:<你的端口>/dsh-usage-dashboard/snapshot
```

返回 `{"ok":true,...}` 即 Host 半已就绪。首次打开会扫描全部会话日志，通常一两秒；之后走 revision 缓存，只有变动的会话会重读（实测冷读约 800ms，热读约 25ms）。

## 配置

价格表在 `cordis.patch.yml` 里，安装后也可在插件管理页修改：

```yaml
- insert:
    - id: dsh-usage-dashboard
      name: dsh-usage-dashboard
      config:
        historyDays: 182      # 日序列与热力图窗口（折线图从中切片）
        maxSessions: 600      # 最多扫描最近 N 个会话
        pricing:
          currency: CNY
          unit: 1000000       # 单价按「每 N 个 token」计
          default: { miss: 2, hit: 0.2, write: 2, output: 3 }
          models:
            deepseek-v4.1-flash: { miss: 2, hit: 0.2, write: 2, output: 3 }
            deepseek-v4-pro: { miss: 4, hit: 1, write: 4, output: 12 }
```

- 模型键先按 **完全匹配**，再按 **最长前缀** 匹配（`deepseek-v4-pro` 也覆盖 `deepseek-v4-pro-2026`），都不中的落到 `default`
- 费用公式：`(miss × 输入 + hit × 缓存命中 + write × 缓存写入 + output × 输出) / unit`

> ⚠️ 内置单价是**估算的起点**，不是账单。改成你实际付费的价格。看板页脚始终显示当前生效的币种与单位。

### 计费口径

会话日志里的 `TokenUsage` 遵循 Anthropic Messages 语义（DeepSeek 路由走的就是这套协议）：

- `inputTokens` 是**未命中缓存**的输入
- `cacheReadTokens` / `cacheWriteTokens` 是**独立计数**，不是 `inputTokens` 的子集
- `prompt = input + cacheRead + cacheWrite`，`tokens = prompt + output`

## 工作原理

全部数字都从会话日志推导，插件本身不持有事实来源：

```
assistant/message ─┬─ data.usage          → 四类 token 计数
                   └─ data.message.source → provider + model
```

- Host 半通过 `sessionPersistence` 读取日志，按 `SessionPersistenceSnapshot.revision` 做增量缓存（缓存挂在 `Symbol.for` 全局上，HMR 重挂载不会重新全量扫描）
- 只读一个路由：`GET /dsh-usage-dashboard/snapshot[?refresh=1]`，`no-store`
- 客户端只负责渲染，每 60 秒拉一次快照，手动刷新会同时重读账户余额

## 卸载

```
plugin_manager action=remove_bundle target=dsh-usage-dashboard
```

## 已知限制

- 只统计本进程 `sessionPersistence.list()` 能看到且没有被 `maxSessions` 截断的会话
- 余额需要宿主挂载 `deepseekAccount`；没有时会显示「未启用」而不是失败
- 会话日志若被其他工具归档移走，不会计入

## 许可

MIT
