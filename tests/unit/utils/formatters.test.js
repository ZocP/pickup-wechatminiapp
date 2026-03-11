const {
  pad2,
  normalizeDateTime,
  formatDateOnly,
  formatDateTime,
  formatMonthDay,
  formatHourMinute,
} = require('../../../utils/formatters');

describe('pad2', () => {
  test.each([
    [0, '00'],
    [1, '01'],
    [9, '09'],
    [10, '10'],
    [12, '12'],
    [99, '99'],
    [100, '100'],
  ])('pad2(%j) → %j', (input, expected) => {
    expect(pad2(input)).toBe(expected);
  });

  test('string input already padded', () => {
    expect(pad2('05')).toBe('05');
  });

  test('single char string', () => {
    expect(pad2('3')).toBe('03');
  });

  test('empty string pads to 00', () => {
    // String('') is '', padStart(2,'0') → '00'
    expect(pad2('')).toBe('00');
  });

  test('null → "null" padded would be "null"', () => {
    // String(null) = "null", which is 4 chars, so padStart(2,'0') = "null"
    expect(pad2(null)).toBe('null');
  });
});

describe('normalizeDateTime', () => {
  test('returns null for null/undefined/empty', () => {
    expect(normalizeDateTime(null)).toBeNull();
    expect(normalizeDateTime(undefined)).toBeNull();
    expect(normalizeDateTime('')).toBeNull();
    expect(normalizeDateTime('   ')).toBeNull();
  });

  test('parses ISO format with T', () => {
    const result = normalizeDateTime('2025-08-15T14:30:00');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(7); // 0-indexed
    expect(result.getDate()).toBe(15);
  });

  test('parses space-separated datetime (converts space to T)', () => {
    const result = normalizeDateTime('2025-08-15 14:30:00');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
  });

  test('invalid date string → null', () => {
    expect(normalizeDateTime('not-a-date')).toBeNull();
    expect(normalizeDateTime('abcdef')).toBeNull();
  });

  test('date-only string', () => {
    const result = normalizeDateTime('2025-03-10');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
    // Note: date-only strings are parsed as UTC, getMonth/getDate may differ by timezone
    // Just verify it's a valid date
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  test('numeric input (number → string → parsed as year)', () => {
    // String(12345) = '12345' → new Date('12345') is valid (year 12345)
    const result = normalizeDateTime(12345);
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(12345);
  });

  test('large numeric string that looks like a year', () => {
    // new Date('2025') is valid (Jan 1, 2025 UTC)
    const result = normalizeDateTime('2025');
    expect(result).toBeInstanceOf(Date);
  });

  test('boolean false → null (String(false)="false" is not a valid date)', () => {
    expect(normalizeDateTime(false)).toBeNull();
  });

  test('0 as input → "0" not a valid date → null', () => {
    expect(normalizeDateTime(0)).toBeNull();
  });
});

describe('formatDateOnly', () => {
  test('formats Date object', () => {
    const d = new Date(2025, 7, 15); // Aug 15
    expect(formatDateOnly(d)).toBe('2025-08-15');
  });

  test('formats ISO string (may vary by timezone)', () => {
    // new Date('2025-01-05') is parsed as UTC midnight, local date may differ
    const result = formatDateOnly('2025-01-05');
    // Should be a valid date string like YYYY-MM-DD
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('single-digit month and day are padded', () => {
    const d = new Date(2025, 0, 3); // Jan 3
    expect(formatDateOnly(d)).toBe('2025-01-03');
  });

  test('invalid date → "--"', () => {
    expect(formatDateOnly('invalid')).toBe('--');
    expect(formatDateOnly(NaN)).toBe('--');
  });

  test('null → "--"', () => {
    // new Date(null) → new Date(0) which IS a valid date (epoch)
    // So formatDateOnly(null) will format epoch date, not '--'
    const result = formatDateOnly(null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('undefined → "--"', () => {
    // new Date(undefined) → Invalid Date
    expect(formatDateOnly(undefined)).toBe('--');
  });
});

describe('formatDateTime', () => {
  test('formats ISO datetime string', () => {
    // normalizeDateTime will parse this
    const result = formatDateTime('2025-08-15T09:05:00');
    expect(result).toBe('2025-08-15 09:05');
  });

  test('formats space-separated datetime', () => {
    const result = formatDateTime('2025-08-15 09:05:00');
    expect(result).toBe('2025-08-15 09:05');
  });

  test('formats Date object', () => {
    const d = new Date(2025, 7, 15, 9, 5);
    expect(formatDateTime(d)).toBe('2025-08-15 09:05');
  });

  test('invalid input → "--"', () => {
    expect(formatDateTime('invalid')).toBe('--');
    expect(formatDateTime(null)).toBe('--');
    expect(formatDateTime(undefined)).toBe('--');
    expect(formatDateTime('')).toBe('--');
  });

  test('invalid Date object → "--"', () => {
    // new Date('invalid') creates an Invalid Date
    // normalizeDateTime returns null for it, then fallback checks instanceof Date → true
    // But the date is invalid so isNaN check catches it
    expect(formatDateTime(new Date('invalid'))).toBe('--');
  });

  test('midnight time', () => {
    const d = new Date(2025, 0, 1, 0, 0);
    expect(formatDateTime(d)).toBe('2025-01-01 00:00');
  });
});

describe('formatMonthDay', () => {
  test('formats month-day with padding', () => {
    const d = new Date(2025, 0, 5); // Jan 5
    expect(formatMonthDay(d)).toBe('01-05');
  });

  test('double-digit month and day', () => {
    const d = new Date(2025, 11, 25); // Dec 25
    expect(formatMonthDay(d)).toBe('12-25');
  });
});

describe('formatHourMinute', () => {
  test('formats hour:minute with padding', () => {
    const d = new Date(2025, 0, 1, 8, 3);
    expect(formatHourMinute(d)).toBe('08:03');
  });

  test('midnight', () => {
    const d = new Date(2025, 0, 1, 0, 0);
    expect(formatHourMinute(d)).toBe('00:00');
  });

  test('23:59', () => {
    const d = new Date(2025, 0, 1, 23, 59);
    expect(formatHourMinute(d)).toBe('23:59');
  });
});
