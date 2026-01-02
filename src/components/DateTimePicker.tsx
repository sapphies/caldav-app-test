import { useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import ChevronLeft from 'lucide-react/icons/chevron-left';
import ChevronRight from 'lucide-react/icons/chevron-right';
import X from 'lucide-react/icons/x';
import Clock from 'lucide-react/icons/clock';
import CalendarIcon from 'lucide-react/icons/calendar';

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  showTime?: boolean;
}

export function DateTimePicker({ value, onChange, placeholder = 'Select date...', showTime = true }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value) {
      return {
        hours: value.getHours(),
        minutes: value.getMinutes(),
      };
    }
    return { hours: 12, minutes: 0 };
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // pad start of month
  const startPadding = monthStart.getDay();
  const paddedDays = Array(startPadding).fill(null).concat(days);

  const handleDayClick = (day: Date) => {
    const newDate = new Date(day);
    newDate.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
    onChange(newDate);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', value: number) => {
    const newTime = { ...selectedTime, [type]: value };
    setSelectedTime(newTime);
    
    if (value !== undefined) {
      const currentValue = value ?? new Date();
      const newDate = new Date(currentValue);
      newDate.setHours(newTime.hours, newTime.minutes, 0, 0);
      onChange(newDate);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setIsOpen(false);
  };

  const formatDisplayValue = () => {
    if (!value) return placeholder;
    if (showTime) {
      return format(value, 'MMM d, yyyy h:mm a');
    }
    return format(value, 'MMM d, yyyy');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg hover:border-surface-300 dark:hover:border-surface-500 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50 transition-colors"
      >
        <CalendarIcon className="w-4 h-4 text-surface-400 flex-shrink-0" />
        <span className={value ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400'}>
          {formatDisplayValue()}
        </span>
        {value && (
          <X 
            className="w-4 h-4 ml-auto text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 flex-shrink-0" 
            onClick={handleClear}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg animate-scale-in w-[280px]">
          <div className="flex items-center justify-between p-3 border-b border-surface-200 dark:border-surface-700">
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

          <div className="grid grid-cols-7 gap-1 px-2 py-2 border-b border-surface-200 dark:border-surface-700">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-surface-500 dark:text-surface-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 p-2">
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

          {showTime && (
            <div className="p-3 border-t border-surface-200 dark:border-surface-700">
              <div className="flex items-center gap-2">
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
          )}

          <div className="flex gap-2 p-3 border-t border-surface-200 dark:border-surface-700">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange(now);
                setIsOpen(false);
              }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
                onChange(tomorrow);
                setIsOpen(false);
              }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                nextWeek.setHours(selectedTime.hours, selectedTime.minutes, 0, 0);
                onChange(nextWeek);
                setIsOpen(false);
              }}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
            >
              Next week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
