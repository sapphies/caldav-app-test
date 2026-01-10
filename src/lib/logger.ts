/**
 * Consistent logging system for the application
 * Provides pretty, categorized logging with different levels
 * Logs are forwarded to Tauri's logging plugin for persistent file storage
 */

import {
  attachConsole,
  debug as tauriDebug,
  error as tauriError,
  info as tauriInfo,
  warn as tauriWarn,
} from '@tauri-apps/plugin-log';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /** Minimum log level to display */
  minLevel?: LogLevel;
  /** Whether to include timestamps */
  timestamps?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get log level from environment or default to 'info' in production, 'debug' in development
const getDefaultMinLevel = (): LogLevel => {
  // In development (Vite), show debug logs. In production, show info+
  // Check for common development indicators
  const isDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port !== '');
  return isDev ? 'debug' : 'info';
};

// Forward logs to Tauri's logging plugin for file persistence
const forwardToTauri = (level: LogLevel, category: string, message: string): void => {
  const formattedMessage = `[${category}] ${message}`;
  switch (level) {
    case 'debug':
      tauriDebug(formattedMessage);
      break;
    case 'info':
      tauriInfo(formattedMessage);
      break;
    case 'warn':
      tauriWarn(formattedMessage);
      break;
    case 'error':
      tauriError(formattedMessage);
      break;
  }
};

// Attach console to receive logs from Rust side (for Webview target)
let consoleAttached = false;
export async function initLogger(): Promise<void> {
  if (consoleAttached) return;
  try {
    await attachConsole();
    consoleAttached = true;
  } catch (e) {
    console.warn('Failed to attach console to Tauri logger:', e);
  }
}

class Logger {
  private category: string;
  private color: string;
  private options: Required<LoggerOptions>;

  constructor(category: string, color?: string, options: LoggerOptions = {}) {
    this.category = category;
    this.color = color ?? '#6366f1'; // default indigo
    this.options = {
      minLevel: options.minLevel ?? getDefaultMinLevel(),
      timestamps: options.timestamps ?? false,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.options.minLevel];
  }

  private formatPrefix(_level: LogLevel): string[] {
    const parts: string[] = [];

    if (this.options.timestamps) {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      } as Intl.DateTimeFormatOptions);
      parts.push(`%c${time}`);
    }

    parts.push(`%c[${this.category}]`);

    return parts;
  }

  private getStyles(_level: LogLevel): string[] {
    const styles: string[] = [];

    if (this.options.timestamps) {
      styles.push('color: #9ca3af; font-weight: normal;'); // timestamp in gray
    }

    styles.push(`color: ${this.color}; font-weight: bold;`); // category

    return styles;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const prefix = this.formatPrefix(level);
    const styles = this.getStyles(level);

    const logMethod =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log;

    // Format message with args for Tauri logging
    const fullMessage =
      args.length > 0 ? `${message} ${args.map((a) => JSON.stringify(a)).join(' ')}` : message;

    // Forward to Tauri for file persistence
    forwardToTauri(level, this.category, fullMessage);

    if (args.length > 0) {
      logMethod(prefix.join(' ') + ' ' + message, ...styles, ...args);
    } else {
      logMethod(prefix.join(' ') + ' ' + message, ...styles);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /** Create a child logger with a sub-category */
  child(subCategory: string, color?: string): Logger {
    return new Logger(`${this.category}:${subCategory}`, color || this.color, this.options);
  }

  /** Log a group of related messages */
  group(label: string, fn: () => void): void {
    if (!this.shouldLog('debug')) return;
    console.group(`%c[${this.category}] ${label}`, `color: ${this.color}; font-weight: bold;`);
    fn();
    console.groupEnd();
  }

  /** Log with timing information */
  time<T>(label: string, fn: () => T): T {
    if (!this.shouldLog('debug')) return fn();

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.debug(`${label} completed in ${duration.toFixed(2)}ms`);
    return result;
  }

  /** Async version of time */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.shouldLog('debug')) return fn();

    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.debug(`${label} completed in ${duration.toFixed(2)}ms`);
    return result;
  }
}

/**
 * Create a logger for a specific category
 *
 * @example
 * const log = createLogger('TaskData', '#10b981');
 * log.info('Task created:', task.id);
 * log.error('Failed to save task:', error);
 */
export function createLogger(category: string, color?: string, options?: LoggerOptions): Logger {
  return new Logger(category, color, options);
}

// Pre-configured loggers for common modules
export const loggers = {
  app: createLogger('App', '#6366f1'),
  taskData: createLogger('TaskData', '#10b981'),
  database: createLogger('Database', '#8b5cf6'),
  caldav: createLogger('CalDAV', '#f59e0b'),
  sync: createLogger('Sync', '#3b82f6'),
  menu: createLogger('Menu', '#ec4899'),
  ui: createLogger('UI', '#14b8a6'),
} as const;

// Enable debug mode helper
export function enableDebugMode(): void {
  localStorage.setItem('caldav-tasks-debug', 'true');
  console.log(
    '%c[Logger] Debug mode enabled. Reload to see all debug logs.',
    'color: #10b981; font-weight: bold;',
  );
}

export function disableDebugMode(): void {
  localStorage.removeItem('caldav-tasks-debug');
  console.log(
    '%c[Logger] Debug mode disabled. Reload to hide debug logs.',
    'color: #f59e0b; font-weight: bold;',
  );
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__enableDebugLogs = enableDebugMode;
  (window as any).__disableDebugLogs = disableDebugMode;
}
