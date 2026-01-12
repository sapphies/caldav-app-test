import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from 'date-fns';
import ChevronLeft from 'lucide-react/icons/chevron-left';
import ChevronRight from 'lucide-react/icons/chevron-right';
import Clock from 'lucide-react/icons/clock';
import X from 'lucide-react/icons/x';
import { useEffect, useState } from 'react';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import { useSettingsStore } from '@/store/settingsStore';

interface ReminderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value?: Date;
  onSave: (date: Date) => void;
  title?: string;
}

export function ReminderPickerModal({
  isOpen,
  onClose,
  value,
  onSave,
  title = 'Add Reminder',
}: ReminderPickerModalProps) {
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value) {
      return {
        hours: value.getHours(),
        minutes: value.getMinutes(),
      };
    }
    return { hours: 9, minutes: 0 };
  });

  // Handle ESC key to close modal
  useModalEscapeKey(onClose);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (value) {
        setSelectedDate(value);
        setCurrentMonth(new Date(value));
        setSelectedTime({
          hours: value.getHours(),
          minutes: value.getMinutes(),
        });
      } else {
        setSelectedDate(undefined);
        setCurrentMonth(new Date());
        setSelectedTime({ hours: 9, minutes: 0 });
      }
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  const { startOfWeek: weekStartsSetting } = useSettingsStore.getState();
  const weekStartsOn = weekStartsSetting === 'monday' ? 1 : 0;

  // Generate days of week labels based on setting
  const daysOfWeekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const daysOfWeek =
    weekStartsOn === 1 ? [...daysOfWeekLabels.slice(1), daysOfWeekLabels[0]] : daysOfWeekLabels;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month based on week start setting
  const firstDayOfMonth = monthStart.getDay();
  const startPadding =
    weekStartsOn === 1 ? (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1) : firstDayOfMonth;
  const paddedDays = Array(startPadding).fill(null).concat(days);

  const handleDayClick = (day: Date) => {
    const newDate = new Date(day);
    newDate.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    setSelectedDate(newDate);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', newValue: number) => {
    const newTime = { ...selectedTime, [type]: newValue };
    setSelectedTime(newTime);

    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(newTime.hours, newTime.minutes, 0, 0);
      setSelectedDate(newDate);
    }
  };

  const handleQuickSelect = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    setSelectedDate(newDate);
  };

  const handleSave = () => {
    if (selectedDate) {
      onSave(selectedDate);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 animate-fade-in">
      <div
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-xs animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">{title}</h2>
          <button
            type="button"
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
              <div
                key={day}
                className="text-center text-xs font-medium text-surface-500 dark:text-surface-400"
              >
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

              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors
                    ${
                      isSelected
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

          {/* Time Picker */}
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedDate}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-surface-300 dark:disabled:bg-surface-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {value ? 'Save' : 'Add Reminder'}
          </button>
        </div>
      </div>
    </div>
  );
}
