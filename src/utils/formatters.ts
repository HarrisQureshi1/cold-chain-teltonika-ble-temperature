/**
 * Formats a Unix timestamp (in seconds or ms) to localized date string, or '--' if unavailable
 */
export function formatTimestamp(tsInSeconds?: number | null): string {
  if (!tsInSeconds || tsInSeconds <= 0) return '--';
  const ms = tsInSeconds > 100000000000 ? tsInSeconds : tsInSeconds * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Returns human-readable relative time (e.g. "4m ago", "42m ago"), or '--' if unavailable
 */
export function timeAgo(tsInSeconds?: number | null, currentTimeSec?: number): string {
  if (!tsInSeconds || tsInSeconds <= 0) return '--';
  const now = currentTimeSec || Math.floor(Date.now() / 1000);
  const rawSec = tsInSeconds > 100000000000 ? Math.floor(tsInSeconds / 1000) : tsInSeconds;
  const diffSec = Math.max(0, now - rawSec);

  if (diffSec < 60) return `${Math.floor(diffSec)}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

/**
 * Converts Celsius to Fahrenheit if unit is 'F', or returns '--' if null/undefined
 */
export function formatTemp(tempC?: number | null, unit: 'C' | 'F' = 'C'): string {
  if (tempC === null || tempC === undefined || isNaN(Number(tempC))) {
    return '--';
  }
  const num = Number(tempC);
  if (unit === 'F') {
    const f = (num * 9) / 5 + 32;
    return `${f.toFixed(1)}°F`;
  }
  return `${num.toFixed(1)}°C`;
}

/**
 * Converts display value back to Celsius
 */
export function toCelsius(val: number, unit: 'C' | 'F'): number {
  if (unit === 'F') {
    return Number((((val - 32) * 5) / 9).toFixed(2));
  }
  return Number(val.toFixed(2));
}

/**
 * Converts Celsius to unit value for input fields
 */
export function fromCelsius(tempC: number, unit: 'C' | 'F'): number {
  if (unit === 'F') {
    return Number(((tempC * 9) / 5 + 32).toFixed(1));
  }
  return Number(tempC.toFixed(1));
}

/**
 * Renders value or fallback '--' where data is not available
 */
export function valOrDash(val: any, suffix = ''): string {
  if (val === null || val === undefined || val === '') return '--';
  return `${val}${suffix}`;
}
