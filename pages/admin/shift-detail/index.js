const app = getApp()
const { getDashboard, getPendingRequests, assignStudent, removeStudent, publishShift, updateShift, unpublishShift } = require('../../../utils/api')
const { t } = require('../../../utils/i18n')
const { pad2, normalizeDateTime, formatDateTime, formatMonthDay, formatHourMinute } = require('../../../utils/formatters')
const { resolveRequestName, runWithActionLock: runWithActionLockHelper } = require('../../../utils/helpers')
const { normalizeShiftStatus } = require('../../../utils/status')

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
    const tv = String((item && item.terminal) || '').trim().toUpperCase()
    if (tv && unique.indexOf(tv) === -1) unique.push(tv)
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
      label: t('shift_detail_time_unknown'),
      count: unknown.length,
      items: unknown
    })
  }

  return groups
}

function toPassengerFromRequest(request) {
  const pickupRaw = pickupTimeOf(request)
  const pickupDate = normalizeDateTime(pickupRaw)
  return {
    id: request.id,
    name: resolveRequestName(request),
    flight_no: request.flight_no || request.flightNumber || '--',
    calc_pickup_time: pickupRaw,
    pickup_time_text: formatDateTime(pickupRaw),
    terminal: terminalOf(request),
    checked_luggage_count: toNumber(request.checked_luggage_count || request.checked_bags),
    carryon_luggage_count: toNumber(request.carryon_luggage_count || request.carry_on_bags),
    ride_with_note: String(request.ride_with_note || '').trim(),
    ride_with_wechat: String(request.ride_with_wechat || '').trim(),
    _pickupTs: pickupDate ? pickupDate.getTime() : Number.MAX_SAFE_INTEGER,
    boarded_at: request.boarded_at || null
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
  const rawPercent = Math.round((safeUsed / safeMax) * 100)
  const percent = Math.max(0, Math.min(100, rawPercent))
  let color = '#1989fa'
  if (rawPercent > 100) color = '#ee0a24'
  else if (rawPercent >= 90) color = '#ff976a'
  return {
    used: safeUsed,
    max: Number(max) || 0,
    percent,
    color
  }
}

function markDashboardDirty() {
  const root = getApp()
  if (root && root.globalData) {
    root.globalData.dashboardNeedsRefresh = true
  }
}

function buildI18n() {
  return {
    shift_detail_driver_prefix:      t('shift_detail_driver_prefix'),
    shift_detail_no_route:           t('shift_detail_no_route'),
    shift_detail_seats:              t('shift_detail_seats'),
    shift_detail_checked:            t('shift_detail_checked'),
    shift_detail_carry_on:           t('shift_detail_carry_on'),
    shift_detail_boarding:           t('shift_detail_boarding'),
    shift_detail_boarded_suffix:     t('shift_detail_boarded_suffix'),
    shift_detail_unboarded_suffix:   t('shift_detail_unboarded_suffix'),
    shift_detail_tab_onboard:        t('shift_detail_tab_onboard'),
    shift_detail_tab_pending:        t('shift_detail_tab_pending'),
    shift_detail_no_onboard:         t('shift_detail_no_onboard'),
    shift_detail_pickup_time:        t('shift_detail_pickup_time'),
    shift_detail_luggage_label:      '行李: ',
    shift_detail_luggage_checked:    t('shift_detail_luggage_checked'),
    shift_detail_luggage_carry_on:   t('shift_detail_luggage_carry_on'),
    shift_detail_ride_with_note:     t('shift_detail_ride_with_note'),
    shift_detail_wechat:             t('shift_detail_wechat'),
    shift_detail_remove:             t('shift_detail_remove'),
    shift_detail_no_pending:         t('shift_detail_no_pending'),
    shift_detail_recommended:        t('shift_detail_recommended'),
    shift_detail_late:               t('shift_detail_late'),
    shift_detail_add:                t('shift_detail_add'),
    shift_detail_passenger_boarded:  t('shift_detail_passenger_boarded'),
    shift_detail_passenger_unboarded:t('shift_detail_passenger_unboarded'),
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
      { text: t('shift_detail_filter_all_terminals'), value: 'all' }
    ],
    dayOptions: [
      { text: t('shift_detail_filter_all_days'), value: 'all' }
    ],
    headerTime: '--',
    headerTerminal: '--',
    terminalRoute: '',
    driverText: '--',
    statusText: t('shift_detail_status_unpublished') || t('common_unpublished'),
    statusTagType: 'primary',
    seatUsage: { used: 0, max: 0, percent: 0, color: '#1989fa' },
    checkedUsage: { used: 0, max: 0, percent: 0, color: '#1989fa' },
    carryOnUsage: { used: 0, max: 0, percent: 0, color: '#1989fa' },
    canPublish: false,
    publishButtonText: t('shift_detail_publish_btn'),
    publishing: false,
    actingRequestId: null,
    actionBusy: false,
    onboardCount: 0,
    boardedCount: 0,
    unboardedCount: 0,
    i18n: buildI18n(),
  },

  async onLoad(query) {
    wx.setNavigationBarTitle({ title: t('shift_detail_nav_title') })
    this.setData({ i18n: buildI18n() })

    if (app.isWechatBound && !app.isWechatBound()) {
      wx.reLaunch({ url: '/pages/bind/index' });
      return;
    }
    const shiftId = query && query.id ? String(query.id) : ''
    if (!shiftId) {
      wx.showToast({ title: t('shift_detail_missing_id'), icon: 'none' })
      return
    }
    this.setData({ shiftId })
    await this.loadData()
  },

  _lastLoadTime: 0,
  _pollTimer: null,

  onShow() {
    wx.setNavigationBarTitle({ title: t('shift_detail_nav_title') })
    this.setData({ i18n: buildI18n() })
    const now = Date.now()
    if (this.data.shiftId && now - this._lastLoadTime > 2000) {
      this._lastLoadTime = now
      this.loadData()
    }
    this._startPolling()
  },

  onHide() {
    this._stopPolling()
  },

  onUnload() {
    this._stopPolling()
  },

  _startPolling() {
    this._stopPolling()
    this._pollTimer = setInterval(() => {
      if (this.data.shiftId) {
        this.loadData(true)
      }
    }, 15000)
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  async onPullDownRefresh() {
    try {
      await this.loadData()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  async loadData(silent) {
    this._lastLoadTime = Date.now()
    if (!silent) wx.showLoading({ title: t('shift_detail_loading') })
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
        wx.showToast({ title: t('shift_detail_not_found'), icon: 'none' })
        return
      }

      const pendingRows = Array.isArray(pending)
        ? pending
        : (pending && Array.isArray(pending.items) ? pending.items : [])
      const normalizedOnboard = (shift.requests || shift.passengers || []).map(toPassengerFromRequest)

      const boardedCount = normalizedOnboard.filter(item =>
        item.boarded_at != null
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
      wx.showToast({ title: (error && error.message) || t('shift_detail_load_failed'), icon: 'none' })
    } finally {
      if (!silent) wx.hideLoading()
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
    const statusText = shiftStatus === 'published' ? t('common_published') : t('common_unpublished')
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
      publishButtonText: shiftStatus === 'published' ? t('shift_detail_withdraw_btn') : t('shift_detail_publish_btn')
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

    const terminalOptions = [{ text: t('shift_detail_filter_all_terminals'), value: 'all' }].concat(
      Array.from(terminalSet).sort().map((tv) => ({ text: tv, value: tv }))
    )

    const dayOptions = [{ text: t('shift_detail_filter_all_days'), value: 'all' }].concat(
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
        wx.showToast({ title: (error && error.message) || t('shift_detail_add_failed'), icon: 'none' })
      } finally {
        this.setData({ actingRequestId: null })
      }
    })
  },

  async onRemovePassenger(event) {
    const requestId = event.currentTarget.dataset.id
    if (!requestId) return

    const boarded = event.currentTarget.dataset.boarded
    if (boarded) {
      const res = await new Promise((resolve) => {
        wx.showModal({
          title: t('shift_detail_remove_confirm_title') || '确认移除',
          content: t('shift_detail_remove_boarded_confirm') || '该乘客已经登车，确定移除？',
          confirmColor: '#ee0a24',
          success: resolve,
          fail: () => resolve({ confirm: false })
        })
      })
      if (!res.confirm) return
    }

    await this.runWithActionLock(async () => {
      this.setData({ actingRequestId: requestId })
      try {
        await removeStudent(this.data.shiftId, requestId)
        await this.loadData()
        markDashboardDirty()
      } catch (error) {
        wx.showToast({ title: (error && error.message) || t('shift_detail_remove_failed'), icon: 'none' })
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
          await unpublishShift(this.data.shiftId)
          wx.showToast({ title: t('shift_detail_withdraw_success'), icon: 'success' })
        } else {
          await publishShift(this.data.shiftId)
          wx.showToast({ title: t('shift_detail_publish_success'), icon: 'success' })
        }
        await this.loadData()
        markDashboardDirty()
      } catch (error) {
        wx.showToast({ title: (error && error.message) || t('shift_detail_op_failed'), icon: 'none' })
      } finally {
        this.setData({ publishing: false })
      }
    })
  },

  async runWithActionLock(task) {
    return runWithActionLockHelper(this, task)
  }
})
