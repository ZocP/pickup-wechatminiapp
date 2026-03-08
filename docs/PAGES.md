# 页面地图（PAGES.md）

> 最后更新：2026-03-08  
> 分支：claw_dev

---

## TabBar 结构

小程序使用自定义 TabBar（`custom-tab-bar/`），根据角色动态展示标签项。

| Tab 索引 | 页面路径 | 文字 | 对应角色 |
|---|---|---|---|
| 0 | pages/home/index | 首页 | 所有已登录用户 |
| 1 | pages/admin/dashboard/index | 调度 | admin / staff |
| 2 | pages/profile/index | 我的 | 所有已登录用户 |

---

## 完整页面列表

### pages/login/index — 登录页
- **功能**：微信一键登录（`wx.login` → `/auth/login`）
- **入口**：未登录时全局 reLaunch
- **跳出**：绑定页 / Token 验证页 / 首页 / 调度中心
- **API**：`authLogin(code)`、`getAuthMe()`

### pages/bind/index — 绑定信息页
- **功能**：首次登录时绑定真实姓名和微信号
- **入口**：登录后 wechat_id 为空时 reLaunch
- **跳出**：首页 / 调度中心（按角色）
- **API**：`bindProfile({name, wechat_id})`、`getAuthMe()`

### pages/token/index — 注册码验证页
- **功能**：学生输入注册码（由 staff 生成），验证通过后解锁预约权限
- **角色**：student，且 `token_verified = false`
- **入口**：登录后 token_verified=false 时 reLaunch；403 `token_required` 错误时全局跳转
- **跳出**：首页
- **API**：`verifyToken(code)`

### pages/home/index — 首页（TabBar）
- **功能**：按角色分流显示内容
  - **student**：展示最新预约状态（航班、班次时间），跳转预约页
  - **driver**：展示司机入口，跳转司机页
  - **admin/staff**：展示管理快捷入口（调度/司机/人员/Token/修改审核），显示待处理修改数
- **API**：`getMyStudentRequests()`（student）、`getModificationRequests('pending')`（admin/staff）

### pages/student/request/index — 学生预约页
- **功能**：
  1. 提交接机预约（航班号/日期/航站楼/到达时间/行李/同行人）
  2. 追踪预约状态（进度条：待调度→已分配→已发布）
  3. 查看分配的班次信息（司机/车型/出发时间）
  4. 获取并展示登车二维码（status=published 时）
  5. pending 状态下直接编辑预约信息
  6. 已分配/发布状态下提交修改申请
- **角色**：student（需 token_verified）
- **API**：
  - `createStudentRequest(payload)`
  - `getMyStudentRequests()`
  - `updateStudentRequest(id, payload)`（pending 状态编辑）
  - `getBoardingToken(requestId)`（published 状态）
  - `getModificationStatus(requestId)`
- **跳出**：`pages/student/modification/index`

### pages/student/modification/index — 行程修改申请页
- **功能**：学生提交修改申请（新航班/新到达时间/行李/同行人），或撤回待审核申请
- **约束**：修改次数 < 3；落地前 ≥ 24 小时（前端校验）
- **角色**：student（已分配班次）
- **API**：
  - `getMyStudentRequests()`（加载当前数据预填）
  - `getModificationStatus(requestId)`
  - `submitModification(requestId, data)`
  - `withdrawModification(requestId)`

### pages/admin/dashboard/index — 调度中心（TabBar）
- **功能**：
  1. 按日期筛选班次列表（今天/前后/日历选择/全部）
  2. 新建班次（选司机+日期+时间）
  3. 发布/管理每个班次
  4. 待分配学生池（弹出操作表，支持快速分配到指定班次）
  5. 批量操作：分配/移除乘客
  6. 角色模拟切换（admin 专属）
- **角色**：admin / staff
- **API**：
  - `getDashboard(date?)`
  - `getPendingRequests()`
  - `getDrivers()`（创建班次时）
  - `createShift(payload)`
  - `publishShift(shiftId)`
  - `assignStudent(shiftId, requestId)`
  - `removeStudent(shiftId, requestId)`
- **跳出**：`pages/admin/shift-detail/index`、`pages/admin/assign/index`

### pages/admin/shift-detail/index — 班次详情页
- **功能**：
  1. 班次信息（司机、出发时间、航站楼路线、载客量使用率）
  2. 待上车乘客列表（按20分钟窗口分组，支持航站楼/日期筛选，推荐标记）
  3. 已上车乘客列表（登车统计）
  4. 添加/移除乘客
  5. 发布/撤回班次
  6. 自动轮询（15秒）
- **角色**：admin / staff
- **API**：`getDashboard()`、`getPendingRequests()`、`assignStudent()`、`removeStudent()`、`publishShift()`、`unpublishShift()`

### pages/admin/assign/index — 快速分配页
- **功能**：展示所有未分配学生，逐一匹配可用班次并确认分配
- **角色**：admin / staff
- **API**：
  - `getUnassignedRequests()`
  - `getAvailableShifts(arrivalTime)`（按学生到达时间查同日可用班次，附容量信息）
  - `assignRequestToShift(requestId, shiftId)`

### pages/admin/drivers/index — 司机列表页
- **功能**：查看所有司机（含激活班次数/乘客数），新增司机
- **角色**：admin / staff
- **API**：`getDrivers()`、`createDriver(payload)`
- **跳出**：`pages/admin/driver-detail/index`

### pages/admin/driver-detail/index — 司机详情页
- **功能**：查看/编辑司机信息（姓名/车型/车牌/车色/容量），删除司机，查看历史班次
- **角色**：admin（删除仅 admin）
- **API**：`getDriver(id)`、`updateDriver(id, payload)`、`deleteDriver(id)`

### pages/admin/staff/index — 人员角色管理页
- **功能**：查看所有用户，设置/取消 staff 或 driver 角色
- **角色**：admin
- **API**：
  - `getUsers()`
  - `getDrivers()`（选择司机档案）
  - `setUserAsStaff(userId)` / `cancelUserAsStaff(userId)`
  - `setUserAsDriver(userId, driverId)` / `cancelUserAsDriver(userId)`

### pages/admin/modification-requests/index — 修改申请审核页
- **功能**：按状态（pending/全部/approved/rejected）查看修改申请，审批或拒绝
- **角色**：admin / staff
- **API**：
  - `getModificationRequests(status?)`
  - `approveModification(id)`
  - `rejectModification(id, adminNote?)`

### pages/driver/index — 司机工作台
- **功能**：
  1. 查看今日起所有已发布班次（自动选中最近未来班次）
  2. 查看当前班次乘客列表（已登车/未登车）
  3. 扫码登车（wx.scanCode → verifyBoarding，支持继续扫描）
- **角色**：driver
- **API**：
  - `getDriverShifts()`
  - `getShiftPassengers(shiftId)`
  - `verifyBoarding(qrCode)`

### pages/profile/index — 个人中心（TabBar）
- **功能**：显示用户信息，支持角色视角切换（admin 专属），退出登录，语言切换（中/EN）
- **角色**：所有已登录用户
- **API**：无（本地状态 + globalData）

### pages/staff/tokens/index — 注册码管理
- **功能**：生成注册码（指定姓名/付款方式/金额），查看列表，作废，复制
- **角色**：admin / staff
- **API**：
  - `generateToken({name, payment_method, amount})`
  - `getTokenList({page, page_size})`
  - `revokeToken(id)`

---

## 路由守卫逻辑

所有页面的 `onShow` 均检查：
1. `app.isWechatBound()` → false → reLaunch 绑定页
2. 角色匹配 → 否 → showToast + switchTab 首页
3. request.js 全局：403 `token_required` → reLaunch token 验证页

---

## 数据模型速查

### models.Request（预约记录）
```
id, user_id, flight_no, arrival_date, terminal,
checked_bags, carry_on_bags, status(pending/assigned/published),
arrival_time_api, calc_pickup_time, ride_with_note, ride_with_wechat,
boarded_at, boarded_by, modification_count,
user{id,name,wechat_id,...}, shift{...}
```

### models.Shift（班次）
```
id, driver_id, departure_time, status(draft/published),
driver{id,name,car_model,car_plate,car_color,max_seats,max_checked,max_carry_on},
requests[...], staffs[...]
```

### models.User
```
id, name, phone, wechat_id, role(student/staff/admin/driver),
token_verified, driver_id
```

### models.Token（注册码）
```
id, code, status(unused/used/revoked/expired),
payment_method, amount, name,
used_by, used_at, expires_at, created_by, used_by_user{...}
```
