type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: string
  metadata?: Record<string, unknown>
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    const env = process.env.NODE_ENV
    if (env === 'development') return true

    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    const currentLevel = levels.indexOf(level)
    const maxLevel = env === 'production' ? 1 : 3 // warn+ in production

    return currentLevel <= maxLevel
  }

  private formatLogEntry(entry: LogEntry): string {
    const context = entry.context ? ` [${entry.context}]` : ''
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : ''
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}:${context} ${entry.message}${metadata}`
  }

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>
  ) {
    if (!this.shouldLog(level)) return

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
    }

    const formattedMessage = this.formatLogEntry(logEntry)

    switch (level) {
      case 'debug':
        console.debug(formattedMessage)
        break
      case 'info':
        console.info(formattedMessage)
        break
      case 'warn':
        console.warn(formattedMessage)
        break
      case 'error':
        console.error(formattedMessage)
        break
    }
  }

  debug(message: string, context?: string, metadata?: Record<string, unknown>) {
    this.log('debug', message, context, metadata)
  }

  info(message: string, context?: string, metadata?: Record<string, unknown>) {
    this.log('info', message, context, metadata)
  }

  warn(message: string, context?: string, metadata?: Record<string, unknown>) {
    this.log('warn', message, context, metadata)
  }

  error(message: string, context?: string, metadata?: Record<string, unknown>) {
    this.log('error', message, context, metadata)
  }

  // Structured logging for specific use cases
  auth(action: string, userId?: string, metadata?: Record<string, unknown>) {
    this.info(`Auth: ${action}`, 'auth', { userId, ...metadata })
  }

  database(
    operation: string,
    table?: string,
    metadata?: Record<string, unknown>
  ) {
    this.debug(`DB: ${operation}`, 'database', { table, ...metadata })
  }

  api(method: string, path: string, statusCode: number, duration?: number) {
    const level = statusCode >= 400 ? 'warn' : 'info'
    this.log(level, `API: ${method} ${path} ${statusCode}`, 'api', {
      method,
      path,
      statusCode,
      duration,
    })
  }

  performance(
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ) {
    const level = duration > 1000 ? 'warn' : 'info'
    this.log(
      level,
      `Performance: ${operation} (${duration}ms)`,
      'performance',
      {
        operation,
        duration,
        ...metadata,
      }
    )
  }
}

export const logger = new Logger()
