import log from 'electron-log/main'

/**
 * Structured logger for the main process, backed by electron-log.
 *
 * - File transport: 'info' in production, 'debug' in development
 * - Console transport: always enabled ('debug' in development)
 * - In test/plain-Node environments the logger never throws: it falls back
 *   to a console-based implementation if electron-log is unavailable.
 */

export interface ScopedLogger {
  error: (...params: unknown[]) => void
  warn: (...params: unknown[]) => void
  info: (...params: unknown[]) => void
  debug: (...params: unknown[]) => void
  verbose: (...params: unknown[]) => void
}

const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST !== undefined

let initialized = false

/**
 * Initializes electron-log (IPC bridge + transports). Call once, early in startup.
 * Safe to call multiple times; no-op in test environments.
 */
export function initializeLogger(): void {
  if (initialized || isTest) return
  try {
    log.initialize()
    log.transports.file.level = isDev ? 'debug' : 'info'
    log.transports.console.level = isDev ? 'debug' : 'info'
    initialized = true
  } catch {
    // electron-log may fail outside a full Electron environment — fall back to console
  }
}

/** Console-based fallback used when electron-log is unavailable (e.g. plain Node/tests). */
function createConsoleFallback(scope: string): ScopedLogger {
  const prefix = `[${scope}]`
  return {
    error: (...params: unknown[]) => console.error(prefix, ...params),
    warn: (...params: unknown[]) => console.warn(prefix, ...params),
    info: (...params: unknown[]) => console.info(prefix, ...params),
    debug: (...params: unknown[]) => console.debug(prefix, ...params),
    verbose: (...params: unknown[]) => console.debug(prefix, ...params),
  }
}

/**
 * Creates a scoped logger (messages are tagged with the scope name).
 * Never throws: falls back to console when electron-log cannot be used.
 */
export function createScopedLogger(scope: string): ScopedLogger {
  // In tests/plain Node, avoid touching electron-log transports (no file writes, no exceptions)
  if (isTest) return createConsoleFallback(scope)
  try {
    const scoped = log.scope(scope)
    return {
      error: (...params: unknown[]) => scoped.error(...params),
      warn: (...params: unknown[]) => scoped.warn(...params),
      info: (...params: unknown[]) => scoped.info(...params),
      debug: (...params: unknown[]) => scoped.debug(...params),
      verbose: (...params: unknown[]) => scoped.verbose(...params),
    }
  } catch {
    return createConsoleFallback(scope)
  }
}

export { log as logger }
export default log
