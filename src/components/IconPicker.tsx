import { useState } from 'react';
import { type LucideIcon } from 'lucide-react';
import Calendar from 'lucide-react/icons/calendar';
import CheckSquare from 'lucide-react/icons/check-square';
import ListTodo from 'lucide-react/icons/list-todo';
import Briefcase from 'lucide-react/icons/briefcase';
import Home from 'lucide-react/icons/home';
import Heart from 'lucide-react/icons/heart';
import Star from 'lucide-react/icons/star';
import Bookmark from 'lucide-react/icons/bookmark';
import Target from 'lucide-react/icons/target';
import Zap from 'lucide-react/icons/zap';
import Coffee from 'lucide-react/icons/coffee';
import Book from 'lucide-react/icons/book';
import GraduationCap from 'lucide-react/icons/graduation-cap';
import Dumbbell from 'lucide-react/icons/dumbbell';
import ShoppingCart from 'lucide-react/icons/shopping-cart';
import Car from 'lucide-react/icons/car';
import Plane from 'lucide-react/icons/plane';
import Music from 'lucide-react/icons/music';
import Camera from 'lucide-react/icons/camera';
import Gift from 'lucide-react/icons/gift';
import Users from 'lucide-react/icons/users';
import Building2 from 'lucide-react/icons/building-2';
import Wallet from 'lucide-react/icons/wallet';
import Clock from 'lucide-react/icons/clock';

export const calendarIcons: { name: string; icon: LucideIcon }[] = [
  { name: 'calendar', icon: Calendar },
  { name: 'check-square', icon: CheckSquare },
  { name: 'list-todo', icon: ListTodo },
  { name: 'briefcase', icon: Briefcase },
  { name: 'home', icon: Home },
  { name: 'heart', icon: Heart },
  { name: 'star', icon: Star },
  { name: 'bookmark', icon: Bookmark },
  { name: 'target', icon: Target },
  { name: 'zap', icon: Zap },
  { name: 'coffee', icon: Coffee },
  { name: 'book', icon: Book },
  { name: 'graduation-cap', icon: GraduationCap },
  { name: 'dumbbell', icon: Dumbbell },
  { name: 'shopping-cart', icon: ShoppingCart },
  { name: 'car', icon: Car },
  { name: 'plane', icon: Plane },
  { name: 'music', icon: Music },
  { name: 'camera', icon: Camera },
  { name: 'gift', icon: Gift },
  { name: 'users', icon: Users },
  { name: 'building', icon: Building2 },
  { name: 'wallet', icon: Wallet },
  { name: 'clock', icon: Clock },
];

export function getIconByName(name: string): LucideIcon {
  const found = calendarIcons.find(i => i.name === name);
  return found?.icon ?? Calendar;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  color?: string;
}

export function IconPicker({ value, onChange, color = '#3b82f6' }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const SelectedIcon = getIconByName(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-lg border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 flex items-center justify-center hover:border-surface-300 dark:hover:border-surface-500 transition-colors"
        style={{ color }}
      >
        <SelectedIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute z-50 mt-1 p-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg animate-scale-in grid grid-cols-6 gap-1 w-[200px]">
            {calendarIcons.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setIsOpen(false);
                }}
                className={`
                  w-8 h-8 rounded flex items-center justify-center transition-colors
                  ${value === name 
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' 
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                  }
                `}
                style={value === name ? { color } : undefined}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
