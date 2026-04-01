import { describe, it, expect, vi } from 'vitest';
import { getBeijingDate, generateHistoryItemKey } from '../dateUtils';

describe('dateUtils', () => {
  describe('getBeijingDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2026-03-30T08:00:00Z');
      const formatted = getBeijingDate(date);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should fall back to local date if toLocaleDateString fails', () => {
      const date = new Date('2026-03-30T08:00:00Z');
      const spy = vi.spyOn(date, 'toLocaleDateString').mockImplementation((locales, options) => {
        if (options?.timeZone === 'Asia/Shanghai') {
          throw new Error('Invalid timezone');
        }
        return 'fallback-date';
      });

      const formatted = getBeijingDate(date);
      expect(formatted).toBe('fallback-date');
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });

  describe('generateHistoryItemKey', () => {
    it('should use item.id if available', () => {
      const item = { id: 'test-id' };
      expect(generateHistoryItemKey(item, 0)).toBe('test-id');
    });

    it('should generate a composite key if id is missing', () => {
      const item = {
        stockInfo: {
          symbol: 'AAPL',
          lastUpdated: '2026-03-30 10:00:00'
        }
      };
      expect(generateHistoryItemKey(item, 5)).toBe('history-AAPL-2026-03-30 10:00:00-5');
    });

    it('should handle missing stockInfo gracefully', () => {
      const item = {};
      expect(generateHistoryItemKey(item, 10)).toBe('history-unknown-no-time-10');
    });
  });
});
