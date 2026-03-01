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
      // TODO: 需要添加获取司机自己班次的API接口
      // 暂时使用模拟数据
      const mockShifts = [
        {
          id: 1,
          departure_time: '2024-02-29 10:00:00',
          driver_name: '司机A',
          capacity: 4,
          assigned_count: 2,
          status: 'published',
        }
      ];
      
      const mockPassengers = [
        { id: 1, name: '张三', student_id: 'S12345', status: 'assigned' },
        { id: 2, name: '李四', student_id: 'S67890', status: 'assigned' },
      ];

      this.setData({
        shifts: mockShifts,
        currentShift: mockShifts.length > 0 ? mockShifts[0] : null,
        passengers: mockPassengers,
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
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
      // TODO: 调用后端核销接口
      // await api.verifyBoarding(qrCode);
      
      // 模拟成功响应
      wx.showToast({
        title: '登车成功',
        icon: 'success',
      });
      
      this.setData({
        scanResult: {
          success: true,
          message: '学生已成功登车',
          studentName: '张三',
        }
      });
      
      // 刷新乘客列表
      setTimeout(() => {
        this.loadDriverShifts();
      }, 1500);
      
    } catch (error) {
      const errMsg = error.message || '核销失败';
      
      // 检查是否为幂等错误（已登车）
      if (errMsg.includes('已登车') || errMsg.includes('already boarded')) {
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