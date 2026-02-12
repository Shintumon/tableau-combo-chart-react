/**
 * Shared console logger that captures logs into a buffer.
 * Import and call install() as early as possible in each entry point.
 * The buffer is shared within the same JS context (main or dialog).
 */

const logs = []
const MAX_LOGS = 500
let installed = false
let listener = null

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
}

function addLog(type, ...args) {
  const timestamp = new Date().toLocaleTimeString()
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
  const entry = { type, timestamp, message }
  logs.push(entry)
  if (logs.length > MAX_LOGS) logs.shift()
  if (listener) listener(entry)
}

/**
 * Install console interception. Safe to call multiple times (idempotent).
 */
export function install() {
  if (installed) return
  installed = true

  console.log = (...args) => { originalConsole.log(...args); addLog('log', ...args) }
  console.warn = (...args) => { originalConsole.warn(...args); addLog('warn', ...args) }
  console.error = (...args) => { originalConsole.error(...args); addLog('error', ...args) }
  console.info = (...args) => { originalConsole.info(...args); addLog('info', ...args) }

  window.addEventListener('error', (event) => {
    addLog('error', 'Uncaught:', event.error?.message || event.message)
  })
}

/** Get a snapshot of all buffered logs */
export function getLogs() {
  return [...logs]
}

/** Clear the log buffer */
export function clearLogs() {
  logs.length = 0
}

/** Register a listener for new log entries (for React state updates) */
export function setListener(fn) {
  listener = fn
}

/** Remove the listener */
export function removeListener() {
  listener = null
}
