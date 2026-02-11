/**
 * Formats a due_date timestamp to display only the time portion
 * Extracts time directly from ISO string to ensure server/client consistency
 */
export function formatDueTime(dateString: string | null | undefined): string {
  if (!dateString) return "--:--";

  try {
    // Try to extract time from ISO string format (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS)
    // This avoids timezone conversion issues
    const isoMatch = dateString.match(/[T\s](\d{2}):(\d{2})/);
    if (isoMatch) {
      const [, hours, minutes] = isoMatch;
      return `${hours}:${minutes}`;
    }

    // Fallback: parse as date and extract local time
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    return "--:--";
  } catch (error) {
    console.error('Error formatting due time:', error, dateString);
    return "--:--";
  }
}

/**
 * Formats a due_date timestamp to display the date portion
 * Uses consistent date extraction to avoid hydration errors
 */
export function formatDueDate(dateString: string | null | undefined): string {
  if (!dateString) return "Sin fecha";

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      return `${month} ${day}`;
    }
    return "Sin fecha";
  } catch (error) {
    console.error('Error formatting due date:', error, dateString);
    return "Sin fecha";
  }
}

/**
 * Formats any date to short format (month + day)
 * Uses consistent date extraction to avoid hydration errors
 */
export function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return "Sin fecha";

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      return `${month} ${day}`;
    }
    return "Sin fecha";
  } catch (error) {
    console.error('Error formatting short date:', error, dateString);
    return "Sin fecha";
  }
}

/**
 * Check if a due date is overdue
 */
export function isOverdue(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  try {
    return new Date(dateString) < new Date();
  } catch {
    return false;
  }
}

/**
 * Check if a due date is within the next 48 hours
 */
export function isUrgent(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  try {
    const dueDate = new Date(dateString);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  } catch {
    return false;
  }
}

/**
 * Date range period type
 */
export type DateRangePeriod = 'all' | 'today' | 'week' | 'month' | 'year';

/**
 * Get date range for a given period
 * Returns null for 'all' to indicate no date filtering needed
 */
export function getDateRange(period: DateRangePeriod): { start: Date; end: Date } | null {
  if (period === 'all') {
    return null;
  }

  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  switch (period) {
    case 'today':
      // Start and end are both today
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
  }

  // Set to start/end of day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Formats time in HH:MM format
 * Extracts time directly from ISO string to ensure server/client consistency
 */
export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "--:--";

  try {
    // Try to extract time from ISO string format (YYYY-MM-DDTHH:MM:SS)
    const isoMatch = dateString.match(/T(\d{2}):(\d{2})/);
    if (isoMatch) {
      const [, hours, minutes] = isoMatch;
      return `${hours}:${minutes}`;
    }

    // Fallback: parse as date and extract local time
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return "--:--";
  } catch (error) {
    console.error('Error formatting time:', error, dateString);
    return "--:--";
  }
}

/**
 * Formats date to full format (day, month)
 * Uses consistent date extraction to avoid hydration errors
 */
export function formatFullDate(dateString: string | null | undefined): string {
  if (!dateString) return "Sin fecha";

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const month = months[date.getMonth()];
      const day = date.getDate().toString().padStart(2, '0');
      return `${day} de ${month}`;
    }
    return "Sin fecha";
  } catch (error) {
    console.error('Error formatting full date:', error, dateString);
    return "Sin fecha";
  }
}

/**
 * Formats date and time together
 * Extracts components to ensure server/client consistency
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "Sin fecha";

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

      // Extract date components
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();

      // Extract time from ISO string if possible
      const isoMatch = dateString.match(/T(\d{2}):(\d{2})/);
      let timeStr;
      if (isoMatch) {
        const [, hours, minutes] = isoMatch;
        timeStr = `${hours}:${minutes}`;
      } else {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        timeStr = `${hours}:${minutes}`;
      }

      return `${day} ${month} ${year}, ${timeStr}`;
    }
    return "Sin fecha";
  } catch (error) {
    console.error('Error formatting date time:', error, dateString);
    return "Sin fecha";
  }
}

/**
 * Formats a date as day/month/year
 * Uses consistent date extraction to avoid hydration errors
 */
export function formatSimpleDate(dateString: string | null | undefined): string {
  if (!dateString) return "Sin fecha";

  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return "Sin fecha";
  } catch (error) {
    console.error('Error formatting simple date:', error, dateString);
    return "Sin fecha";
  }
}

/**
 * Formats a number with thousands separator
 * Ensures consistency between server and client
 */
export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "0";

  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numValue)) return "0";

  // Format with thousands separator (e.g., 1234567 -> 1.234.567)
  return numValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Urgency level type
 */
export type UrgencyLevel = 'overdue' | 'critical' | 'urgent' | 'soon' | 'normal';

/**
 * Get urgency level based on due date
 */
export function getUrgencyLevel(dueDate: Date | string | null | undefined): UrgencyLevel {
  if (!dueDate) return 'normal';

  try {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Past due
    if (diffHours < 0) return 'overdue';
    // Less than 24 hours
    if (diffHours < 24) return 'critical';
    // Less than 48 hours
    if (diffHours < 48) return 'urgent';
    // Less than 72 hours (3 days)
    if (diffHours < 72) return 'soon';
    // More than 72 hours
    return 'normal';
  } catch {
    return 'normal';
  }
}
