import { format, isToday, isTomorrow, isThisWeek, isSameYear, differenceInCalendarDays } from 'date-fns';

/**
 * Standard date format strings for consistent formatting across the app
 */
export const DATE_FORMATS = {
  shortDate: 'MMM d',
  fullDateTime: 'MMM d, yyyy h:mm a',
  fullDate: 'MMM d, yyyy',
  monthYear: 'MMMM yyyy',
  dayName: 'EEEE',
} as const;


export function formatDueDate(date: Date): { text: string; className: string } {
  const d = new Date(date);
  const now = new Date();
  const time = format(d, 'HH:mm');
  const isOverdue = d.getTime() < now.getTime();
  const dayDiff = differenceInCalendarDays(d, now);

  if (isToday(d)) {
    return {
      text: `Today ${time}`,
      className: isOverdue
        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
    };
  }

  if (dayDiff === -1) {
    return {
      text: `Yesterday ${time}`,
      className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    };
  }

  if (isTomorrow(d)) {
    return {
      text: `Tmrw ${time}`,
      className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    };
  }

  if (isThisWeek(d)) {
    return {
      text: `${format(d, 'EEE')} ${time}`,
      className: 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700',
    };
  }

  if (isSameYear(d, now)) {
    return {
      text: `${format(d, 'MMM d')}, ${time}`,
      className: isOverdue
        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
        : 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700',
    };
  }

  return {
    text: `${format(d, 'MMM d, yyyy')} ${time}`,
    className: isOverdue
      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
      : 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700',
  };
}