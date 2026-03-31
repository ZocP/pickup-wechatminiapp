// Must mock i18n before requiring status
jest.mock('../../../utils/i18n', () => ({
  t: (key) => {
    const map = {
      status_pending: '待分配',
      status_assigned: '已分配待发布',
      status_published: '已发布',
    };
    return map[key] || key;
  },
}));

const { normalizeStatus, normalizeShiftStatus, requestStatusText } = require('../../../utils/status');

describe('normalizeStatus', () => {
  test.each([
    ['PENDING', 'pending'],
    ['Pending', 'pending'],
    ['pending', 'pending'],
    ['  ASSIGNED  ', 'assigned'],
    ['Published', 'published'],
  ])('normalizeStatus(%j) → %j', (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });

  test.each([
    [null, ''],
    [undefined, ''],
    ['', ''],
    // String(0 || '') → String('') → '' because 0 is falsy
    [0, ''],
    // String(false || '') → String('') → '' because false is falsy
    [false, ''],
  ])('normalizeStatus(%j) → %j (edge cases)', (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });
});

describe('normalizeShiftStatus', () => {
  test('draft → unpublished', () => {
    expect(normalizeShiftStatus('draft')).toBe('unpublished');
  });

  test('Draft (case-insensitive) → unpublished', () => {
    expect(normalizeShiftStatus('Draft')).toBe('unpublished');
  });

  test('DRAFT → unpublished', () => {
    expect(normalizeShiftStatus('DRAFT')).toBe('unpublished');
  });

  test('published passes through', () => {
    expect(normalizeShiftStatus('published')).toBe('published');
  });

  test('Published (mixed case) → published', () => {
    expect(normalizeShiftStatus('Published')).toBe('published');
  });

  test.each([
    [null, 'unpublished'],
    [undefined, 'unpublished'],
    ['', 'unpublished'],
  ])('normalizeShiftStatus(%j) → %j (falsy → unpublished)', (input, expected) => {
    expect(normalizeShiftStatus(input)).toBe(expected);
  });

  test('unknown status passes through lowercased', () => {
    expect(normalizeShiftStatus('CUSTOM')).toBe('custom');
  });
});

describe('requestStatusText', () => {
  test.each([
    ['pending', '待分配'],
    ['PENDING', '待分配'],
    ['  Pending  ', '待分配'],
    ['assigned', '已分配待发布'],
    ['ASSIGNED', '已分配待发布'],
    ['published', '已发布'],
    ['Published', '已发布'],
  ])('requestStatusText(%j) → %j', (input, expected) => {
    expect(requestStatusText(input)).toBe(expected);
  });

  test('unknown status returns original', () => {
    expect(requestStatusText('custom_status')).toBe('custom_status');
  });

  test('null → "--"', () => {
    expect(requestStatusText(null)).toBe('--');
  });

  test('undefined → "--"', () => {
    expect(requestStatusText(undefined)).toBe('--');
  });

  test('empty string → "--"', () => {
    expect(requestStatusText('')).toBe('--');
  });
});
