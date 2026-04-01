/**
 * Safely formats a date to Beijing time (Asia/Shanghai).
 * Falls back to local date string if the timezone is not supported.
 */
export function getBeijingDate(date: Date): string {
  try {
    return date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch (e) {
    console.warn('Failed to get Beijing date, falling back to local date:', e);
    return date.toLocaleDateString();
  }
}

/**
 * Generates a unique key for history items to avoid React duplicate key warnings.
 */
export function generateHistoryItemKey(item: any, index: number): string {
  if (item.id) return item.id;
  const symbol = item.stockInfo?.symbol || 'unknown';
  const time = item.stockInfo?.lastUpdated || 'no-time';
  return `history-${symbol}-${time}-${index}`;
}
