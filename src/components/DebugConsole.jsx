import { useState, useEffect, useRef, useCallback } from 'react'

function DebugConsole() {
  const [isVisible, setIsVisible] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const contentRef = useRef(null)
  const panelRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // Intercept console methods
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    const originalInfo = console.info

    const addLog = (type, ...args) => {
      const timestamp = new Date().toLocaleTimeString()
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')

      setLogs(prev => [...prev.slice(-199), { type, timestamp, message }])

      // Auto-scroll to bottom
      if (contentRef.current) {
        setTimeout(() => {
          contentRef.current.scrollTop = contentRef.current.scrollHeight
        }, 0)
      }
    }

    console.log = (...args) => {
      originalLog(...args)
      addLog('log', ...args)
    }

    console.warn = (...args) => {
      originalWarn(...args)
      addLog('warn', ...args)
    }

    console.error = (...args) => {
      originalError(...args)
      addLog('error', ...args)
    }

    console.info = (...args) => {
      originalInfo(...args)
      addLog('info', ...args)
    }

    // Global error handler
    const handleError = (event) => {
      console.error('Uncaught Error:', event.error?.message || event.message, event.error?.stack || '')
    }
    window.addEventListener('error', handleError)

    // Check for ?debug=1 in URL or localhost
    const isDebugMode = window.location.search.includes('debug=1') ||
                        window.location.search.includes('debug=true') ||
                        window.location.hostname === 'localhost'

    if (isDebugMode) {
      setIsVisible(true)
      setIsPanelOpen(true)

      // Log environment info
      setTimeout(() => {
        console.info('=== DEBUG CONSOLE INITIALIZED ===')
        console.info('Hostname:', window.location.hostname)
        console.info('Port:', window.location.port)
        console.info('User Agent:', navigator.userAgent)

        // Tableau info
        if (typeof tableau !== 'undefined') {
          try {
            console.info('Tableau Extensions API:', tableau.extensions ? 'Available' : 'Not Available')
            if (tableau.extensions?.environment) {
              console.info('Tableau Environment:', tableau.extensions.environment)
            }
          } catch (e) {
            console.warn('Could not access Tableau info:', e.message)
          }
        } else {
          console.warn('Tableau Extensions API not loaded yet')
        }
        console.info('=================================')
      }, 100)
    }

    // Cleanup
    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      console.info = originalInfo
      window.removeEventListener('error', handleError)
    }
  }, [])

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setIsVisible(prev => !prev)
        if (!isVisible) {
          console.log('[DEBUG] Debug console activated')
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  // Ref-based drag for smooth performance (no re-renders during drag)
  const handleDragMove = useCallback((e) => {
    if (!isDraggingRef.current || !panelRef.current) return
    const x = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffsetRef.current.x))
    const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffsetRef.current.y))
    panelRef.current.style.left = `${x}px`
    panelRef.current.style.top = `${y}px`
    panelRef.current.style.right = 'auto'
    panelRef.current.style.bottom = 'auto'
  }, [])

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
  }, [handleDragMove])

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.debug-actions')) return
    isDraggingRef.current = true
    const rect = panelRef.current.getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }, [handleDragMove, handleDragEnd])

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  const handleClear = (e) => {
    e.stopPropagation()
    setLogs([])
    console.log('Debug console cleared')
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    console.log('[DebugConsole] Copy button clicked')

    const text = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n')

    if (text.length === 0) {
      console.warn('[DebugConsole] No logs to copy')
      alert('No logs to copy yet!')
      return
    }

    console.log('[DebugConsole] Attempting to copy', text.length, 'characters')

    // Use execCommand as primary method (works best in Tableau webview)
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)

      textarea.focus()
      textarea.select()

      const success = document.execCommand('copy')
      console.log('[DebugConsole] execCommand result:', success)

      document.body.removeChild(textarea)

      if (success) {
        console.info('✓ Logs copied to clipboard!')
      } else {
        throw new Error('execCommand returned false')
      }
      return
    } catch (err) {
      console.error('[DebugConsole] Copy failed:', err)
      // execCommand failed, show alert as fallback
      const preview = text.length > 500 ? text.substring(0, 500) + '\n\n... (truncated)' : text
      alert('📋 Copy Logs\n\nCould not copy automatically. Please manually copy:\n\n' + preview)
    }
  }

  const handleHide = (e) => {
    e.stopPropagation()
    setIsVisible(false)
    console.log('Debug mode hidden')
  }

  const handleClose = (e) => {
    e.stopPropagation()
    setIsPanelOpen(false)
  }

  if (!isVisible) return null

  return (
    <>
      <button
        className="debug-toggle"
        onClick={() => setIsPanelOpen(prev => !prev)}
        title="Toggle Debug Console (Ctrl+Shift+D)"
      >
        🐛
      </button>

      {isPanelOpen && (
        <div
          className="debug-panel"
          ref={panelRef}
        >
          <div className="debug-header" onMouseDown={handleMouseDown}>
            <span>Debug Console (drag to move)</span>
            <div className="debug-actions">
              <button onClick={handleClear} title="Clear logs">Clear</button>
              <button onClick={handleCopy} title="Copy all logs">Copy</button>
              <button onClick={handleHide} title="Hide debug mode">Hide</button>
              <button onClick={handleClose} title="Close">×</button>
            </div>
          </div>
          <div className="debug-content" ref={contentRef}>
            {logs.map((log, index) => (
              <div key={index} className={`debug-log debug-${log.type}`}>
                <span className="debug-time">[{log.timestamp}]</span>
                <span className="debug-type">{log.type}</span>
                <span className="debug-message">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="debug-empty">No logs yet...</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default DebugConsole
