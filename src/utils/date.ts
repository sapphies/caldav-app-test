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


export function formatDueDate(date: Date): { text: string; className: string; borderColor: string; bgColor: string; textColor: string } {
  const d = new Date(date);
  const now = new Date();
  const time = format(d, 'HH:mm');
  const isOverdue = d.getTime() < now.getTime();
  const dayDiff = differenceInCalendarDays(d, now);

  // Helper to create colors - use the color itself for text to match other badges
  const getColors = (color: string) => {
    return { 
      borderColor: color,
      bgColor: `${color}15`, // ~8% opacity for subtle background
      textColor: color 
    };
  };

  if (isToday(d)) {
    const colors = isOverdue 
      ? getColors('#dc2626') // red for overdue
      : getColors('#d97706'); // amber for today

    return {
      text: `Today ${time}`,
      className: isOverdue
        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
      ...colors,
    };
  }

  if (dayDiff === -1) {
    const colors = getColors('#dc2626'); // red for yesterday

    return {
      text: `Yesterday ${time}`,
      className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
      ...colors,
    };
  }

  if (isTomorrow(d)) {
    const colors = getColors('#3b82f6'); // blue for tomorrow

    return {
      text: `Tmrw ${time}`,
      className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
      ...colors,
    };
  }

  if (isThisWeek(d)) {
    const colors = getColors('#64748b'); // slate for this week

    return {
      text: `${format(d, 'EEE')} ${time}`,
      className: 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700',
      ...colors,
    };
  }

  if (isSameYear(d, now)) {
    const colors = isOverdue
      ? getColors('#dc2626') // red for overdue
      : getColors('#64748b'); // slate for future

    return {
      text: `${format(d, 'MMM d')}, ${time}`,
      className: isOverdue
        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
        : 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700',
      ...colors,
    };
  }

  const colors = isOverdue
    ? getColors('#dc2626') // red for overdue
    : getColors('#64748b'); // slate for future

  return {
    text: `${format(d, 'MMM d, yyyy')} ${time}`,
    className: isOverdue
      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
      : 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700',
    ...colors,
  };
}