const api = require('../../utils/api');
const { formatDateTime } = require('../../utils/formatters');

Page({
  data: {
    loading: false,
    shifts: [],
    currentShift: null,
    passengers: [],
    showScanModal: false,
    scanResult: null,
    scanning: false,
  },

  onShow() {
    this.loadDriverShifts();
  },

  async onPullDownRefresh() {
    try {
      await this.loadDriverShifts();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadDriverShifts() {
    this.setData({ loading: true });
    try {
      // 获取司机班次
      const shiftsRes = await api.getDriverShifts();
      const shifts = Array.isArray(shiftsRes) ? shiftsRes : (shiftsRes.data || shiftsRes.shifts || []);
      
      // 获取当前班次（假设第一个是当前班次，或根据状态筛选）
      const currentShift = shifts.find(shift => 
        shift.status === 'published' || shift.status === 'active'
      ) || (shifts.length > 0 ? shifts[0] : null);
      
      let passengers = [];
      if (currentShift && currentShift.id) {
        try {
          // 获取班次乘客
          const passengersRes = await api.getShiftPassengers(currentShift.id);
          passengers = Array.isArray(passengersRes) ? passengersRes : (passengersRes.data || passengersRes.passengers || []);
          
          // 确保乘客有正确的状态字段
          passengers = passengers.map(passenger => ({
            ...passenger,
            status: passenger.status || passenger.boarding_status || 'assigned',
            name: passenger.name || passenger.user_name || passenger.student_name || passenger.passenger_name || `乘客#${passenger.id}`,
            student_id: passenger.student_id || passenger.student_id_number || passenger.user_id || '',
          }));
        } catch (passengerError) {
          console.warn('获取乘客列表失败:', passengerError);
          // 如果获取乘客失败，使用空数组
        }
      }

      this.setData({
        shifts: shifts,
        currentShift: currentShift,
        passengers: passengers,
      });
      
      // 如果没有班次，显示提示
      if (!currentShift) {
        wx.showToast({
          title: '暂无班次安排',
          icon: 'none',
        });
      }
    } catch (error) {
      console.error('加载班次失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      
      // 出错时清空数据
      this.setData({
        shifts: [],
        currentShift: null,
        passengers: [],
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 打开扫码模态框
  openScanModal() {
    this.setData({
      showScanModal: true,
      scanResult: null,
    });
  },

  // 关闭扫码模态框
  closeScanModal() {
    this.setData({ showScanModal: false });
  },

  // 开始扫码
  async startScan() {
    if (this.data.scanning) return;
    
    this.setData({ scanning: true });
    try {
      const res = await wx.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode']
      });
      
      if (res && res.result) {
        await this.verifyBoarding(res.result);
      }
    } catch (error) {
      if (error.errMsg !== 'scanCode:fail cancel') {
        wx.showToast({
          title: '扫码失败',
          icon: 'none',
        });
      }
    } finally {
      this.setData({ scanning: false });
    }
  },

  // 核销登车
  async verifyBoarding(qrCode) {
    try {
      // 调用后端核销接口
      const result = await api.verifyBoarding(qrCode);
      
      // 解析响应
      const success = result.success || result.status === 'success' || result.boarded === true;
      const message = result.message || result.msg || '登车成功';
      const studentName = result.student_name || result.name || result.passenger_name || '';
      
      if (success) {
        wx.showToast({
          title: '登车成功',
          icon: 'success',
        });
        
        this.setData({
          scanResult: {
            success: true,
            message: message,
            studentName: studentName,
          }
        });
        
        // 立即刷新乘客列表
        await this.loadDriverShifts();
      } else {
        // 处理失败情况（包括幂等错误）
        const errMsg = message || '核销失败';
        
        // 检查是否为幂等错误（已登车）
        if (errMsg.includes('已登车') || errMsg.includes('already boarded') || 
            errMsg.includes('重复') || errMsg.includes('duplicate')) {
          wx.showToast({
            title: '该学生已登车',
            icon: 'none',
          });
          
          this.setData({
            scanResult: {
              success: false,
              message: '该学生已登车，无需重复核销',
              studentName: studentName,
            }
          });
        } else {
          wx.showToast({
            title: errMsg,
            icon: 'none',
          });
          
          this.setData({
            scanResult: {
              success: false,
              message: errMsg,
            }
          });
        }
      }
      
    } catch (error) {
      const errMsg = error.message || '核销失败';
      
      // 检查是否为幂等错误（已登车）
      if (errMsg.includes('已登车') || errMsg.includes('already boarded') || 
          errMsg.includes('重复') || errMsg.includes('duplicate')) {
        wx.showToast({
          title: '该学生已登车',
          icon: 'none',
        });
        
        this.setData({
          scanResult: {
            success: false,
            message: '该学生已登车，无需重复核销',
          }
        });
      } else {
        wx.showToast({
          title: errMsg,
          icon: 'none',
        });
        
        this.setData({
          scanResult: {
            success: false,
            message: errMsg,
          }
        });
      }
    }
  },

  // 格式化时间显示
  formatTime(timeStr) {
    if (!timeStr) return '';
    return formatDateTime(timeStr) || timeStr;
  },
});