import { useState, useEffect, useRef } from 'react'

function DebugConsole() {
  const [isVisible, setIsVisible] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const [position, setPosition] = useState({ bottom: 20, right: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const contentRef = useRef(null)
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

      setLogs(prev => [...prev.slice(-499), { type, timestamp, message }])

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

    // Check for ?debug=1 in URL
    if (window.location.search.includes('debug=1') || window.location.search.includes('debug=true')) {
      setIsVisible(true)
      console.log('Debug mode activated via URL parameter')
    }

    // Cleanup
    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      console.info = originalInfo
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

  const handleMouseDown = (e) => {
    if (e.target.closest('.debug-actions')) return
    setIsDragging(true)
    const rect = e.currentTarget.getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return

    const newRight = window.innerWidth - e.clientX + dragOffsetRef.current.x - 400
    const newBottom = window.innerHeight - e.clientY + dragOffsetRef.current.y - 300

    setPosition({
      right: Math.max(0, Math.min(window.innerWidth - 400, newRight)),
      bottom: Math.max(0, Math.min(window.innerHeight - 300, newBottom))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  const handleClear = () => {
    setLogs([])
    console.log('Debug console cleared')
  }

  const handleCopy = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      console.info('Logs copied to clipboard')
    })
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
          style={{
            right: `${position.right}px`,
            bottom: `${position.bottom}px`
          }}
        >
          <div className="debug-header" onMouseDown={handleMouseDown}>
            <span>Debug Console (drag to move)</span>
            <div className="debug-actions">
              <button onClick={handleClear} title="Clear logs">Clear</button>
              <button onClick={handleCopy} title="Copy all logs">Copy</button>
              <button onClick={() => setIsVisible(false)} title="Hide debug mode">Hide</button>
              <button onClick={() => setIsPanelOpen(false)} title="Close">×</button>
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
