/**
 * Improved Structured Logger
 * Use this for new code, gradually migrate from old logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${levelStr}] ${message}${contextStr}`;
}

export const structuredLogger = {
  debug: (message: string, context?: LogContext) => {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  info: (message: string, context?: LogContext) => {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, context));
    }
  },

  warn: (message: string, context?: LogContext) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context));
    }
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    if (shouldLog('error')) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
      };
      console.error(formatMessage('error', message, errorContext));
    }
  },

  // Domain-specific logging
  security: (event: string, context: LogContext) => {
    structuredLogger.info(`[SECURITY] ${event}`, context);
  },

  a2a: (event: string, context: LogContext) => {
    structuredLogger.info(`[A2A] ${event}`, context);
  },

  mcp: (event: string, context: LogContext) => {
    structuredLogger.info(`[MCP] ${event}`, context);
  },

  performance: (operation: string, duration: number, context?: LogContext) => {
    structuredLogger.info(`[PERF] ${operation}`, { ...context, durationMs: duration });
  },
};
