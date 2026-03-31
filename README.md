# UIUC Airport Pickup Scheduler — WeChat Mini Program

> v1-stable | 微信小程序前端

UIUC 机场接机调度系统的微信小程序客户端，配合 Go 后端 (`wechat`) 使用。

## 技术栈

- **框架**：微信小程序原生开发（WXML / WXSS / JS / JSON）
- **UI 组件库**：[Vant Weapp](https://vant-contrib.gitee.io/vant-weapp/)
- **国际化**：自研 i18n 方案（`utils/i18n.js`，支持中/英切换）
- **后端 API**：RESTful `/api/v1`，JWT 鉴权

## 功能概览

### 学生端
- 微信一键登录 + 注册码验证
- 绑定真实姓名与微信号
- 提交接机预约（航班号/到达日期/航站楼/行李/同行人）
- 实时追踪预约状态（待调度 → 已分配 → 已发布）
- 查看班次详情与司机信息
- 登车二维码（班次发布后）
- 提交行程修改申请 & 撤回

### 管理端（admin / staff）
- 调度中心：按日期管理班次，新建/发布/撤回班次
- 待分配学生池 & 快速分配
- 班次详情：乘客管理、容量监控、登车统计
- 司机管理：增删改查司机档案
- 人员角色管理：设置/取消 staff、driver 角色
- 修改申请审核：批准/拒绝学生修改请求
- 全部班次：分页浏览、按状态筛选、多维排序
- 学生管理：搜索/筛选预约，推荐班次，重新分配
- 注册码管理：生成/查看/作废注册码
- 智能推荐：自动建议新班次

### 司机端
- 查看已发布班次与乘客列表
- 扫码登车核销

### 通用
- 角色视角切换（admin 可模拟 student / staff / driver 视角）
- 中英文切换
- 自定义 TabBar（按角色动态显示）

## 页面结构

### TabBar 页面
| 路径 | 标签 | 说明 |
|------|------|------|
| `pages/home/index` | 首页 | 角色分流入口 |
| `pages/admin/dashboard/index` | 调度 | 班次调度中心 |
| `pages/profile/index` | 我的 | 个人中心 |

### 其他页面
| 路径 | 说明 |
|------|------|
| `pages/login/index` | 微信登录 |
| `pages/bind/index` | 绑定姓名/微信号 |
| `pages/token/index` | 注册码验证 |
| `pages/student/request/index` | 学生预约 |
| `pages/student/modification/index` | 行程修改申请 |
| `pages/driver/index` | 司机工作台 |
| `pages/admin/shift-detail/index` | 班次详情 |
| `pages/admin/assign/index` | 快速分配 |
| `pages/admin/drivers/index` | 司机列表 |
| `pages/admin/driver-detail/index` | 司机详情 |
| `pages/admin/staff/index` | 人员角色管理 |
| `pages/admin/modification-requests/index` | 修改申请审核 |
| `pages/admin/all-shifts/index` | 全部班次 |
| `pages/admin/student-mgmt/index` | 学生管理 |
| `pages/staff/tokens/index` | 注册码管理 |

## 组件

| 组件 | 说明 |
|------|------|
| `components/shift-card` | 班次卡片（含司机信息、容量、登车状态） |

## 工具模块

| 文件 | 说明 |
|------|------|
| `utils/request.js` | 全局请求封装，JWT 注入，错误拦截 |
| `utils/api.js` | API 接口定义 |
| `utils/i18n.js` | 国际化 |
| `utils/formatters.js` | 日期/时间格式化 |
| `utils/status.js` | 状态码映射与文本 |
| `utils/helpers.js` | 通用辅助函数 |
| `utils/logger.js` | 日志工具 |
| `utils/qrcode.js` | QR 码生成 |
| `utils/ui.js` | UI 工具（TabBar 控制等） |

## 开发设置

### 环境要求
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- Node.js（用于 npm 依赖）
- 后端服务运行中（Go backend `wechat` 项目）

### 步骤

1. 克隆项目并进入目录
   ```bash
   git clone <repo-url>
   cd pickup-wechatminiapp
   git checkout v1-stable
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 配置项目
   - 复制 `project.config.example.json` 为 `project.config.json`
   - 填入你的微信小程序 `appid`

4. 在微信开发者工具中打开项目目录

5. 构建 npm
   - 菜单：工具 → 构建 npm

6. 配置后端地址
   - 默认 API 地址在 `utils/request.js` 中的 `DEFAULT_BASE_URL`
   - 生产环境：`https://api.zocpstudio.com/api/v1`
   - 本地开发：修改为 `http://127.0.0.1:9090/api/v1`

## 依赖

- `@vant/weapp` — UI 组件库

## 关联项目

- **后端**：[wechat](https://github.com/your-org/wechat) — Go + Gin + GORM，提供 RESTful API
