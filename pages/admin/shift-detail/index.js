const app = getApp()
const { getDashboard, getPendingRequests, assignStudent, removeStudent, publishShift, updateShift } = require('../../../utils/api')
const { pad2, normalizeDateTime, formatDateTime, formatMonthDay, formatHourMinute } = require('../../../utils/formatters')

function terminalOf(req) {
  return req.terminal || req.arrival_terminal || req.flight_terminal || req.arrival_gate || ''
}

function pickupTimeOf(req) {
  return req.calc_pickup_time || req.pickup_time || req.expected_arrival_time || req.arrival_time || ''
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function driverOf(shift) {
  const nested = shift && shift.driver
  if (nested && (nested.name || nested.car_model || nested.max_seats || nested.max_checked || nested.max_carry_on)) {
    return nested
  }
  const name = (shift && (shift.driver_name || shift.driverName)) || ''
  const car = (shift && (shift.car_model || shift.vehicle_model || shift.vehicle_plate)) || ''
  if (!name && !car) return null
  return {
    name,
    car_model: car,
    max_seats: shift && (shift.max_passengers || shift.max_seats),
    max_checked: shift && (shift.max_checked_luggage || shift.max_checked),
    max_carry_on: shift && (shift.max_carry_on_luggage || shift.max_carry_on)
  }
}

function capacityOf(shift, type) {
  const driver = driverOf(shift) || {}
  if (type === 'seats') {
    return toNumber(driver.max_seats || (shift && (shift.max_passengers || shift.max_seats)))
  }
  if (type === 'checked') {
    return toNumber(driver.max_checked || (shift && (shift.max_checked_luggage || shift.max_checked)))
  }
  return toNumber(driver.max_carry_on || (shift && (shift.max_carry_on_luggage || shift.max_carry_on)))
}

function shiftTerminalOf(shift, onboardList) {
  if (shift && shift.arrival_terminal) return String(shift.arrival_terminal).trim().toUpperCase()
  if (shift && shift.terminal) return String(shift.terminal).trim().toUpperCase()
  if (shift && Array.isArray(shift.terminals) && shift.terminals.length) {
    return String(shift.terminals[0] || '').trim().toUpperCase() || '--'
  }
  const firstTerminal = (onboardList || []).find((x) => x && x.terminal)
  return firstTerminal ? String(firstTerminal.terminal).trim().toUpperCase() : '--'
}

function terminalRouteOf(shift, onboardList) {
  if (shift && Array.isArray(shift.terminals) && shift.terminals.length) {
    const route = shift.terminals
      .map((item) => String(item || '').trim().toUpperCase())
      .filter(Boolean)
    return route.join(' -> ')
  }
  if (shift && shift.terminal_route) {
    return String(shift.terminal_route).trim()
  }
  const unique = []
  ;(onboardList || []).forEach((item) => {
    const t = String((item && item.terminal) || '').trim().toUpperCase()
    if (t && unique.indexOf(t) === -1) unique.push(t)
  })
  return unique.join(' -> ')
}

function groupByTwentyMinutes(items, getTs) {
  const known = []
  const unknown = []

  ;(items || []).forEach((item) => {
    const ts = Number(getTs(item))
    if (Number.isFinite(ts) && ts < Number.MAX_SAFE_INTEGER) {
      known.push({ item, ts })
    } else {
      unknown.push(item)
    }
  })

  known.sort((a, b) => a.ts - b.ts)

  const groupsMap = new Map()
  known.forEach(({ item, ts }) => {
    const bucketStart = Math.floor(ts / (20 * 60 * 1000)) * 20 * 60 * 1000
    const key = String(bucketStart)
    if (!groupsMap.has(key)) {
      const startDate = new Date(bucketStart)
      const endDate = new Date(bucketStart + 19 * 60 * 1000)
      groupsMap.set(key, {
        key,
        sortTs: bucketStart,
        label: `${formatMonthDay(startDate)} ${formatHourMinute(startDate)}-${formatHourMinute(endDate)}`,
        items: []
      })
    }
    groupsMap.get(key).items.push(item)
  })

  const groups = Array.from(groupsMap.values()).sort((a, b) => a.sortTs - b.sortTs)
  groups.forEach((group) => {
    group.count = group.items.length
  })

  if (unknown.length) {
    groups.push({
      key: 'unknown',
      sortTs: Number.MAX_SAFE_INTEGER,
      label: '时间待确认',
      count: unknown.length,
      items: unknown
    })
  }

  return groups
}

function toPassengerFromRequest(request) {
  const pickupRaw = pickupTimeOf(request)
  const pickupDate = normalizeDateTime(pickupRaw)
  const user = request && request.user ? request.user : {}
  const resolvedName = user.name
    || user.real_name
    || user.user_name
    || user.nickname
    || request.real_name
    || request.passenger_name
    || request.user_name
    || request.student_name
    || request.nickname
    || request.name
    || ''
  return {
    id: request.id,
    name: String(resolvedName).trim() || `学生#${request.user_id || request.id}`,
    flight_no: request.flight_no || request.flightNumber || '--',
    calc_pickup_time: pickupRaw,
    pickup_time_text: formatDateTime(pickupRaw),
    terminal: terminalOf(request),
    checked_luggage_count: toNumber(request.checked_luggage_count || request.checked_bags),
    carryon_luggage_count: toNumber(request.carryon_luggage_count || request.carry_on_bags),
    ride_with_note: String(request.ride_with_note || '').trim(),
    ride_with_wechat: String(request.ride_with_wechat || '').trim(),
    _pickupTs: pickupDate ? pickupDate.getTime() : Number.MAX_SAFE_INTEGER
  }
}

function isLate(pickupTime, shiftTime) {
  const pickup = normalizeDateTime(pickupTime)
  const shift = normalizeDateTime(shiftTime)
  if (!pickup || !shift) return false
  return pickup.getTime() < shift.getTime()
}

function sameTerminal(a, b) {
  if (!a || !b) return false
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase()
}

function withinWindowMinutes(a, b, minutes) {
  const da = normalizeDateTime(a)
  const db = normalizeDateTime(b)
  if (!da || !db) return false
  return Math.abs(da.getTime() - db.getTime()) <= minutes * 60 * 1000
}

function usageOf(used, max) {
  const safeMax = Number(max) > 0 ? Number(max) : 1
  const safeUsed = Number(used) || 0
  const percent = Math.max(0, Math.min(200, Math.round((safeUsed / safeMax) * 100)))
  let color = '#1989fa'
  if (percent > 100) color = '#ee0a24'
  else if (percent >= 90) color = '#ff976a'
  return {
    used: safeUsed,
    max: Number(max) || 0,
    percent,
    color
  }
}

function normalizeShiftStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'draft') return 'unpublished'
  return value || 'unpublished'
}

function markDashboardDirty() {
  const root = getApp()
  if (root && root.globalData) {
    root.globalData.dashboardNeedsRefresh = true
  }
}

Page({
  data: {
    shiftId: '',
    shift: null,
    pendingRaw: [],
    pendingView: [],
    pendingGroups: [],
    onboardList: [],
    onboardGroups: [],
    activeTab: 0,
    terminalFilter: 'all',
    dayFilter: 'all',
    terminalOptions: [
      { text: '全部航站楼', value: 'all' }
    ],
    dayOptions: [
      { text: '全部日期', value: 'all' }
    ],
    headerTime: '--',
    headerTerminal: '--',
    terminalRoute: '',
    driverText: '--',
    statusText: '未发布',
    statusTagType: 'primary',
    seatUsage: { used: 0, max: 0, percent: 0, color: '#1989fa' },
    checkedUsage: { used: 0, max: 0, percent: 0, color: '#1989fa' },
    carryOnUsage: { used: 0, max: 0, percent: 0, color: '#1989fa' },
    canPublish: false,
    publishButtonText: '一键发布班次',
    publishing: false,
    actingRequestId: null,
    actionBusy: false,
    onboardCount: 0,
    boardedCount: 0,
    unboardedCount: 0
  },

  async onLoad(query) {
    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }
    const shiftId = query && query.id ? String(query.id) : ''
    if (!shiftId) {
      wx.showToast({ title: '缺少班次ID', icon: 'none' })
      return
    }
    this.setData({ shiftId })
    await this.loadData()
  },

  async onPullDownRefresh() {
    try {
      await this.loadData()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  async loadData() {
    wx.showLoading({ title: '加载中' })
    try {
      const [dashboard, pending] = await Promise.all([
        getDashboard(),
        getPendingRequests()
      ])

      const dashboardRows = Array.isArray(dashboard)
        ? dashboard
        : (dashboard && Array.isArray(dashboard.shifts) ? dashboard.shifts : [])

      const shifts = dashboardRows.map((item) => ({
        ...item,
        id: item.id || item.ID || item.shift_id || 0,
        status: normalizeShiftStatus(item.status || item.Status),
        departure_time: item.departure_time || item.DepartureTime || '',
        requests: Array.isArray(item.requests)
          ? item.requests
          : (Array.isArray(item.Requests)
            ? item.Requests
            : (Array.isArray(item.passengers) ? item.passengers : []))
      }))

      const shift = shifts.find((item) => String(item.id) === String(this.data.shiftId))
      if (!shift) {
        wx.showToast({ title: '班次不存在或已删除', icon: 'none' })
        return
      }

      const pendingRows = Array.isArray(pending)
        ? pending
        : (pending && Array.isArray(pending.items) ? pending.items : [])
      const normalizedOnboard = (shift.requests || shift.passengers || []).map(toPassengerFromRequest)

      // 计算已登车和待登车数量
      const boardedCount = normalizedOnboard.filter(item => 
        item.status === 'boarded' || item.boarded === true || item.boarding_status === 'boarded'
      ).length;
      const unboardedCount = normalizedOnboard.length - boardedCount;

      this.setData({
        shift,
        pendingRaw: pendingRows,
        onboardList: normalizedOnboard,
        onboardCount: normalizedOnboard.length,
        boardedCount: boardedCount,
        unboardedCount: unboardedCount
      })

      this.syncHeaderAndUsage()
      this.recomputeFiltersAndList()
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  syncHeaderAndUsage() {
    const shift = this.data.shift || {}
    const onboard = this.data.onboardList || []
    const driver = driverOf(shift)

    const seatUsed = onboard.length
    const seatMax = capacityOf(shift, 'seats')

    const checkedUsed = onboard.reduce((sum, item) => sum + toNumber(item.checked_luggage_count || item.checked_bags), 0)
    const checkedMax = capacityOf(shift, 'checked')

    const carryOnUsed = onboard.reduce((sum, item) => sum + toNumber(item.carryon_luggage_count || item.carry_on_bags), 0)
    const carryOnMax = capacityOf(shift, 'carryOn')

    const shiftStatus = normalizeShiftStatus(shift.status)
    const statusText = shiftStatus === 'published' ? '已发布' : '未发布'
    const statusTagType = shiftStatus === 'published' ? 'success' : 'primary'

    this.setData({
      headerTime: formatDateTime(shift.departure_time),
      headerTerminal: shiftTerminalOf(shift, onboard),
      terminalRoute: terminalRouteOf(shift, onboard),
      driverText: (driver && driver.name)
        ? `${driver.name}${driver.car_model ? ` (${driver.car_model})` : ''}`
        : (shift.driver_name || shift.vehicle_plate || '--'),
      statusText,
      statusTagType,
      seatUsage: usageOf(seatUsed, seatMax),
      checkedUsage: usageOf(checkedUsed, checkedMax),
      carryOnUsage: usageOf(carryOnUsed, carryOnMax),
      canPublish: shiftStatus === 'published' ? true : seatUsed > 0,
      publishButtonText: shiftStatus === 'published' ? '撤回发布' : '一键发布班次'
    })
  },

  recomputeFiltersAndList() {
    const shift = this.data.shift || {}
    const pending = this.data.pendingRaw || []
    const onboardIds = new Set((this.data.onboardList || []).map((item) => String(item.id)))

    const candidates = pending
      .filter((req) => !onboardIds.has(String(req.id)))
      .map((req) => {
        const base = toPassengerFromRequest(req)
        const recommended =
          sameTerminal(base.terminal, shift.arrival_terminal || shift.terminal) ||
          withinWindowMinutes(base.calc_pickup_time, shift.departure_time, 45)
        const late = isLate(base.calc_pickup_time, shift.departure_time)
        const pickupDate = normalizeDateTime(base.calc_pickup_time)
        const pickupTs = pickupDate ? pickupDate.getTime() : Number.MAX_SAFE_INTEGER
        const departureDate = normalizeDateTime(shift.departure_time)
        const departureTs = departureDate ? departureDate.getTime() : 0
        const delta = Math.abs(pickupTs - departureTs)
        return {
          ...base,
          recommended,
          late,
          _pickupTs: pickupTs,
          _delta: delta,
          _terminal: String(base.terminal || '').toUpperCase(),
          _day: pickupDate ? `${pickupDate.getFullYear()}-${pad2(pickupDate.getMonth() + 1)}-${pad2(pickupDate.getDate())}` : '--'
        }
      })

    const terminalSet = new Set()
    const daySet = new Set()
    candidates.forEach((item) => {
      if (item._terminal) terminalSet.add(item._terminal)
      if (item._day && item._day !== '--') daySet.add(item._day)
    })

    const terminalOptions = [{ text: '全部航站楼', value: 'all' }].concat(
      Array.from(terminalSet).sort().map((t) => ({ text: t, value: t }))
    )

    const dayOptions = [{ text: '全部日期', value: 'all' }].concat(
      Array.from(daySet).sort().map((d) => ({ text: d, value: d }))
    )

    const terminalFilter = terminalOptions.some((x) => x.value === this.data.terminalFilter) ? this.data.terminalFilter : 'all'
    const dayFilter = dayOptions.some((x) => x.value === this.data.dayFilter) ? this.data.dayFilter : 'all'

    const filtered = candidates
      .filter((item) => (terminalFilter === 'all' ? true : item._terminal === terminalFilter))
      .filter((item) => (dayFilter === 'all' ? true : item._day === dayFilter))
      .sort((a, b) => {
        if (a.late !== b.late) return a.late ? 1 : -1
        if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
        if (a._delta !== b._delta) return a._delta - b._delta
        return a._pickupTs - b._pickupTs
      })

    const pendingGroups = groupByTwentyMinutes(filtered, (item) => item._pickupTs)
    const onboardSorted = (this.data.onboardList || []).slice().sort((a, b) => (a._pickupTs || Number.MAX_SAFE_INTEGER) - (b._pickupTs || Number.MAX_SAFE_INTEGER))
    const onboardGroups = groupByTwentyMinutes(onboardSorted, (item) => item._pickupTs)

    this.setData({
      terminalOptions,
      dayOptions,
      terminalFilter,
      dayFilter,
      pendingView: filtered,
      pendingGroups,
      onboardGroups
    })
  },

  onTabChange(event) {
    const index = event && event.detail ? event.detail.index : 0
    this.setData({ activeTab: index || 0 })
  },

  onTerminalChange(event) {
    this.setData({ terminalFilter: event.detail }, () => this.recomputeFiltersAndList())
  },

  onDayChange(event) {
    this.setData({ dayFilter: event.detail }, () => this.recomputeFiltersAndList())
  },

  async onAddPassenger(event) {
    const requestId = event.currentTarget.dataset.id
    if (!requestId) return

    await this.runWithActionLock(async () => {
      this.setData({ actingRequestId: requestId })
      try {
        await assignStudent(this.data.shiftId, requestId)
        await this.loadData()
        markDashboardDirty()
      } catch (error) {
        wx.showToast({ title: (error && error.message) || '添加失败', icon: 'none' })
      } finally {
        this.setData({ actingRequestId: null })
      }
    })
  },

  async onRemovePassenger(event) {
    const requestId = event.currentTarget.dataset.id
    if (!requestId) return

    await this.runWithActionLock(async () => {
      this.setData({ actingRequestId: requestId })
      try {
        await removeStudent(this.data.shiftId, requestId)
        await this.loadData()
        markDashboardDirty()
      } catch (error) {
        wx.showToast({ title: (error && error.message) || '移出失败', icon: 'none' })
      } finally {
        this.setData({ actingRequestId: null })
      }
    })
  },

  async onPublishShift() {
    if (!this.data.canPublish || this.data.publishing) return

    await this.runWithActionLock(async () => {
      this.setData({ publishing: true })
      try {
        const shiftStatus = this.data.shift && this.data.shift.status ? this.data.shift.status : ''
        const isPublished = String(shiftStatus).toLowerCase() === 'published'
        if (isPublished) {
          await updateShift(this.data.shiftId, { status: 'unpublished' })
          wx.showToast({ title: '已撤回发布', icon: 'success' })
        } else {
          await publishShift(this.data.shiftId)
          wx.showToast({ title: '发布成功', icon: 'success' })
        }
        await this.loadData()
        markDashboardDirty()
      } catch (error) {
        wx.showToast({ title: (error && error.message) || '操作失败', icon: 'none' })
      } finally {
        this.setData({ publishing: false })
      }
    })
  },

  async runWithActionLock(task) {
    if (this.data.actionBusy) {
      wx.showToast({ title: '操作进行中，请稍候', icon: 'none' })
      return
    }

    this.setData({ actionBusy: true })
    try {
      await task()
    } finally {
      this.setData({ actionBusy: false })
    }
  }
})
