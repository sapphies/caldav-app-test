import { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays } from 'date-fns';
import { useSettingsStore } from '@/store/settingsStore';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import ChevronLeft from 'lucide-react/icons/chevron-left';
import ChevronRight from 'lucide-react/icons/chevron-right';
import X from 'lucide-react/icons/x';
import Clock from 'lucide-react/icons/clock';
import Sun from 'lucide-react/icons/sun';
import Trash2 from 'lucide-react/icons/trash-2';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value?: Date;
  onChange: (date: Date | undefined, allDay?: boolean) => void;
  title: string;
  allDay?: boolean;
  onAllDayChange?: (allDay: boolean) => void;
}

export function DatePickerModal({
  isOpen,
  onClose,
  value,
  onChange,
  title,
  allDay = false,
  onAllDayChange,
}: DatePickerModalProps) {
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value && !allDay) {
      return {
        hours: value.getHours(),
        minutes: value.getMinutes(),
      };
    }
    return { hours: 12, minutes: 0 };
  });
  const [localAllDay, setLocalAllDay] = useState(allDay);

  // Sync allDay state when prop changes
  useEffect(() => {
    setLocalAllDay(allDay);
  }, [allDay]);

  // Sync selectedTime when value changes
  useEffect(() => {
    if (value && !allDay) {
      setSelectedTime({
        hours: value.getHours(),
        minutes: value.getMinutes(),
      });
    }
  }, [value, allDay]);

  // Handle ESC key to close modal
  useModalEscapeKey(onClose);

  if (!isOpen) return null;

  const { startOfWeek: weekStartsSetting } = useSettingsStore.getState();
  const weekStartsOn = weekStartsSetting === 'monday' ? 1 : 0;

  // Generate days of week labels based on setting
  const daysOfWeekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const daysOfWeek = weekStartsOn === 1 
    ? [...daysOfWeekLabels.slice(1), daysOfWeekLabels[0]] 
    : daysOfWeekLabels;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month based on week start setting
  const firstDayOfMonth = monthStart.getDay();
  const startPadding = weekStartsOn === 1 
    ? (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1)
    : firstDayOfMonth;
  const paddedDays = Array(startPadding).fill(null).concat(days);

  const handleDayClick = (day: Date) => {
    const newDate = new Date(day);
    if (localAllDay) {
      newDate.setHours(0, 0, 0, 0);
    } else {
      newDate.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    }
    onChange(newDate, localAllDay);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', newValue: number) => {
    const newTime = { ...selectedTime, [type]: newValue };
    setSelectedTime(newTime);

    if (value !== undefined) {
      const newDate = new Date(value);
      newDate.setHours(newTime.hours, newTime.minutes, 0, 0);
      onChange(newDate, localAllDay);
    }
  };

  const handleAllDayToggle = () => {
    const newAllDay = !localAllDay;
    setLocalAllDay(newAllDay);
    onAllDayChange?.(newAllDay);

    if (value) {
      const newDate = new Date(value);
      if (newAllDay) {
        newDate.setHours(0, 0, 0, 0);
      } else {
        newDate.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
      }
      onChange(newDate, newAllDay);
    }
  };

  const handleQuickSelect = (date: Date) => {
    const newDate = new Date(date);
    if (localAllDay) {
      newDate.setHours(0, 0, 0, 0);
    } else {
      newDate.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    }
    onChange(newDate, localAllDay);
    onClose();
  };

  const handleClear = () => {
    onChange(undefined, false);
    onAllDayChange?.(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div 
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-xs animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Quick select buttons */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleQuickSelect(new Date())}
              className="flex-1 px-3 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(addDays(new Date(), 1))}
              className="flex-1 px-3 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(addDays(new Date(), 7))}
              className="flex-1 px-3 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 rounded-lg transition-colors"
            >
              Next week
            </button>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-400 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-surface-500 dark:text-surface-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {paddedDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} />;
              }

              const isSelected = value && isSameDay(day, value);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors
                    ${isSelected
                      ? 'bg-primary-600 text-white'
                      : isTodayDate
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                        : isCurrentMonth
                          ? 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                          : 'text-surface-400 dark:text-surface-600'
                    }
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2 py-3 border-t border-surface-200 dark:border-surface-700">
            <Sun className="w-4 h-4 text-surface-400" />
            <span className="text-sm text-surface-600 dark:text-surface-400">All day</span>
            <button
              type="button"
              onClick={handleAllDayToggle}
              className={`ml-auto relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                localAllDay ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  localAllDay ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Time Picker - hidden when all day */}
          {!localAllDay && (
            <div className="flex items-center gap-2 py-3 border-t border-surface-200 dark:border-surface-700">
              <Clock className="w-4 h-4 text-surface-400" />
              <span className="text-sm text-surface-600 dark:text-surface-400">Time</span>
              <div className="flex-1 flex items-center justify-end gap-1">
                <select
                  value={selectedTime.hours}
                  onChange={(e) => handleTimeChange('hours', parseInt(e.target.value))}
                  className="px-2 py-1 text-sm bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded text-surface-700 dark:text-surface-300 focus:outline-none focus:border-primary-300"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="text-surface-500">:</span>
                <select
                  value={selectedTime.minutes}
                  onChange={(e) => handleTimeChange('minutes', parseInt(e.target.value))}
                  className="px-2 py-1 text-sm bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded text-surface-700 dark:text-surface-300 focus:outline-none focus:border-primary-300"
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 p-4 border-t border-surface-200 dark:border-surface-700">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
