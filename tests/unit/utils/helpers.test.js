jest.mock('../../../utils/i18n', () => ({
  t: (key) => {
    const map = {
      common_student_prefix: '学生#',
      common_ride_with_prefix: '同乘: ',
      common_wechat_prefix: '微信: ',
      common_op_in_progress: '操作进行中，请稍候',
    };
    return map[key] || key;
  },
}));

const { resolveRequestName, buildRideWithText, runWithActionLock } = require('../../../utils/helpers');

describe('resolveRequestName', () => {
  test('returns user.name when present', () => {
    expect(resolveRequestName({ user: { name: 'Alice' } })).toBe('Alice');
  });

  test('returns user.real_name when name is absent', () => {
    expect(resolveRequestName({ user: { real_name: 'Bob' } })).toBe('Bob');
  });

  test('returns user.user_name as fallback', () => {
    expect(resolveRequestName({ user: { user_name: 'Charlie' } })).toBe('Charlie');
  });

  test('returns user.nickname as fallback', () => {
    expect(resolveRequestName({ user: { nickname: 'Dave' } })).toBe('Dave');
  });

  test('falls back to request-level real_name', () => {
    expect(resolveRequestName({ real_name: 'Eve' })).toBe('Eve');
  });

  test('falls back to request-level passenger_name', () => {
    expect(resolveRequestName({ passenger_name: 'Frank' })).toBe('Frank');
  });

  test('falls back to request-level user_name', () => {
    expect(resolveRequestName({ user_name: 'Grace' })).toBe('Grace');
  });

  test('falls back to request-level student_name', () => {
    expect(resolveRequestName({ student_name: 'Heidi' })).toBe('Heidi');
  });

  test('falls back to request-level nickname', () => {
    expect(resolveRequestName({ nickname: 'Ivan' })).toBe('Ivan');
  });

  test('falls back to request-level name', () => {
    expect(resolveRequestName({ name: 'Judy' })).toBe('Judy');
  });

  test('priority: user.name > request.real_name', () => {
    expect(resolveRequestName({ user: { name: 'User' }, real_name: 'Request' })).toBe('User');
  });

  test('falls back to 学生#user_id when no name fields exist', () => {
    expect(resolveRequestName({ user_id: 42 })).toBe('学生#42');
  });

  test('falls back to 学生#id when user_id is also absent', () => {
    expect(resolveRequestName({ id: 7 })).toBe('学生#7');
  });

  test('falls back to 学生#-- when no id', () => {
    expect(resolveRequestName({})).toBe('学生#--');
  });

  test('null request → throws (no null guard on request-level fields)', () => {
    // The function does `request.real_name` which throws on null
    expect(() => resolveRequestName(null)).toThrow();
  });

  test('undefined request → throws', () => {
    expect(() => resolveRequestName(undefined)).toThrow();
  });

  test('trims whitespace-only name → fallback', () => {
    expect(resolveRequestName({ name: '   ', user_id: 10 })).toBe('学生#10');
  });

  test('empty string name → fallback', () => {
    expect(resolveRequestName({ name: '', user_id: 5 })).toBe('学生#5');
  });

  test('user object exists but empty → fallback', () => {
    expect(resolveRequestName({ user: {}, id: 3 })).toBe('学生#3');
  });
});

describe('buildRideWithText', () => {
  test('both note and wechat', () => {
    expect(buildRideWithText({ ride_with_note: '和张三同车', ride_with_wechat: 'zhangsan123' }))
      .toBe('同乘: 和张三同车 | 微信: zhangsan123');
  });

  test('only note', () => {
    expect(buildRideWithText({ ride_with_note: '和张三同车' })).toBe('同乘: 和张三同车');
  });

  test('only wechat', () => {
    expect(buildRideWithText({ ride_with_wechat: 'zhangsan123' })).toBe('微信: zhangsan123');
  });

  test('neither → empty string', () => {
    expect(buildRideWithText({})).toBe('');
  });

  test('null → empty string', () => {
    expect(buildRideWithText(null)).toBe('');
  });

  test('undefined → empty string', () => {
    expect(buildRideWithText(undefined)).toBe('');
  });

  test('whitespace-only note and wechat → empty string', () => {
    expect(buildRideWithText({ ride_with_note: '   ', ride_with_wechat: '  ' })).toBe('');
  });

  test('note present, wechat whitespace-only', () => {
    expect(buildRideWithText({ ride_with_note: 'test', ride_with_wechat: '  ' })).toBe('同乘: test');
  });

  test('note whitespace-only, wechat present', () => {
    expect(buildRideWithText({ ride_with_note: '  ', ride_with_wechat: 'wx123' })).toBe('微信: wx123');
  });
});

describe('runWithActionLock', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      data: { actionBusy: false },
      setData: jest.fn((obj) => { Object.assign(ctx.data, obj); }),
    };
    wx.showToast.mockClear();
  });

  test('runs task and sets actionBusy correctly', async () => {
    const task = jest.fn(async () => 'result');
    await runWithActionLock(ctx, task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(ctx.setData).toHaveBeenCalledWith({ actionBusy: true });
    expect(ctx.setData).toHaveBeenCalledWith({ actionBusy: false });
    expect(ctx.data.actionBusy).toBe(false);
  });

  test('prevents concurrent execution when already busy', async () => {
    ctx.data.actionBusy = true;
    const task = jest.fn();

    await runWithActionLock(ctx, task);

    expect(task).not.toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalledWith({
      title: '操作进行中，请稍候',
      icon: 'none',
    });
  });

  test('resets actionBusy even if task throws', async () => {
    const task = jest.fn(async () => { throw new Error('fail'); });

    // runWithActionLock does not catch the error, it uses try/finally
    // So it propagates the error but still resets actionBusy
    await expect(runWithActionLock(ctx, task)).rejects.toThrow('fail');
    expect(ctx.data.actionBusy).toBe(false);
  });

  test('setData called with true before task and false after', async () => {
    const callOrder = [];
    ctx.setData = jest.fn((obj) => {
      callOrder.push(obj.actionBusy);
      Object.assign(ctx.data, obj);
    });

    await runWithActionLock(ctx, async () => {});

    expect(callOrder).toEqual([true, false]);
  });
});
