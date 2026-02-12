import { useState, useEffect, useRef, useCallback } from 'react'
import SettingsDialog from './components/SettingsDialog'
import { Config } from './utils/config'
import { install, getLogs, clearLogs, setListener, removeListener } from './utils/logger'
import './styles/App.css'

// Install shared logger for dialog context
install()

function DialogApp() {
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState(null)
  const [columns, setColumns] = useState([])
  const [encodingMap, setEncodingMap] = useState({})
  const [workbookFont, setWorkbookFont] = useState(null)
  const [debugLogs, setDebugLogs] = useState(() => [...getLogs()])

  // Register React state listener for new logs
  useEffect(() => {
    setListener((entry) => {
      setDebugLogs(prev => [...prev.slice(-499), entry])
    })
    return () => { removeListener() }
  }, [])

  const clearDebugLogs = useCallback(() => {
    clearLogs()
    setDebugLogs([])
  }, [])

  useEffect(() => {
    tableau.extensions.initializeDialogAsync().then((payload) => {
      console.log('[Dialog] Initialized with payload length:', payload?.length || 0)

      let payloadConfig = null

      // Parse config, columns, encodingMap and extension logs from payload
      try {
        const parsed = JSON.parse(payload)
        payloadConfig = parsed.config || null
        setColumns(parsed.columns || [])
        setEncodingMap(parsed.encodingMap || {})
        if (parsed.workbookFont) setWorkbookFont(parsed.workbookFont)

        // Prepend main extension logs so debug console shows full history
        if (parsed.extensionLogs && parsed.extensionLogs.length > 0) {
          const extLogs = parsed.extensionLogs.map(l => ({
            ...l,
            message: `[EXT] ${l.message}`
          }))
          setDebugLogs(prev => [...extLogs, ...prev])
        }

        console.log('[Dialog] Columns:', parsed.columns?.length || 0)
        console.log('[Dialog] Encoding map:', JSON.stringify(parsed.encodingMap))
        console.log('[Dialog] Payload config dimension:', payloadConfig?.dimension)
      } catch (err) {
        console.warn('[Dialog] Could not parse payload:', err.message)
      }

      // Use payload config as primary source (has live encoding mappings),
      // fall back to Tableau settings, then defaults
      let loadedConfig = JSON.parse(JSON.stringify(Config.current))

      // Layer 1: Merge saved Tableau settings
      const savedSettings = tableau.extensions.settings.getAll()
      if (savedSettings && Object.keys(savedSettings).length > 0) {
        Object.keys(savedSettings).forEach(key => {
          try {
            loadedConfig[key] = JSON.parse(savedSettings[key])
          } catch {
            loadedConfig[key] = savedSettings[key]
          }
        })
      }

      // Layer 2: Override with live payload config (most up-to-date)
      if (payloadConfig) {
        loadedConfig = { ...loadedConfig, ...payloadConfig }
        console.log('[Dialog] Using live config from payload')
      }

      Config.current = loadedConfig
      setConfig(loadedConfig)
      setReady(true)
    }).catch(err => {
      console.error('[Dialog] Failed to initialize:', err)
    })
  }, [])

  const handleSave = async (newConfig) => {
    // Detect manual mapping: compare data fields against encoding map
    const dataMappingChanged =
      newConfig.dimension !== (encodingMap.dimension || '') ||
      newConfig.bar1Measure !== (encodingMap.bar1 || '') ||
      newConfig.bar2Measure !== (encodingMap.bar2 || '') ||
      newConfig.lineMeasure !== (encodingMap.line || '')

    const configToSave = {
      ...newConfig,
      useManualMapping: dataMappingChanged
    }

    if (dataMappingChanged) {
      console.log('[Dialog] Manual mapping enabled (data fields differ from marks card)')
    } else {
      console.log('[Dialog] Auto mapping preserved')
    }

    // Save to Tableau settings
    Object.keys(configToSave).forEach(key => {
      const value = typeof configToSave[key] === 'object'
        ? JSON.stringify(configToSave[key])
        : configToSave[key]
      tableau.extensions.settings.set(key, value != null ? String(value) : '')
    })

    await tableau.extensions.settings.saveAsync()
    console.log('[Dialog] Settings saved, closing dialog')
    tableau.extensions.ui.closeDialog('saved')
  }

  const handleApply = async (newConfig) => {
    const dataMappingChanged =
      newConfig.dimension !== (encodingMap.dimension || '') ||
      newConfig.bar1Measure !== (encodingMap.bar1 || '') ||
      newConfig.bar2Measure !== (encodingMap.bar2 || '') ||
      newConfig.lineMeasure !== (encodingMap.line || '')

    const configToSave = {
      ...newConfig,
      useManualMapping: dataMappingChanged
    }

    Object.keys(configToSave).forEach(key => {
      const value = typeof configToSave[key] === 'object'
        ? JSON.stringify(configToSave[key])
        : configToSave[key]
      tableau.extensions.settings.set(key, value != null ? String(value) : '')
    })

    await tableau.extensions.settings.saveAsync()
    setConfig(configToSave)
    console.log('[Dialog] Settings applied (dialog stays open)')
  }

  const handleClose = () => {
    console.log('[Dialog] Closing without save')
    tableau.extensions.ui.closeDialog('')
  }

  if (!ready) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '12px',
        color: '#888',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '14px'
      }}>
        <div className="dialog-spinner" />
        Loading settings...
      </div>
    )
  }

  return (
    <SettingsDialog
      config={config}
      columns={columns}
      onSave={handleSave}
      onApply={handleApply}
      onClose={handleClose}
      isDialog
      debugLogs={debugLogs}
      onClearDebugLogs={clearDebugLogs}
      workbookFont={workbookFont}
    />
  )
}

export default DialogApp
