import { useState, useEffect, useRef } from 'react'
import ComboChart from './components/ComboChart'
import LoadingScreen from './components/LoadingScreen'
import ErrorScreen from './components/ErrorScreen'
import useTableauExtension from './hooks/useTableauExtension'
import { Config } from './utils/config'
import './styles/App.css'

function App() {
  const {
    initialized,
    loading,
    error,
    data,
    columns,
    encodingMap,
    refreshData,
    openConfigDialog,
    setConfigureCallback
  } = useTableauExtension()

  // Initialize with a deep copy of defaults
  const [config, setConfig] = useState(() => JSON.parse(JSON.stringify(Config.current)))

  // Track if we've loaded initial settings from Tableau (load only once)
  const hasLoadedInitialSettings = useRef(false)
  // Track debounce timer for saving to Tableau
  const saveTimerRef = useRef(null)

  // Register the configure callback so right-click "Configure" opens the dialog
  useEffect(() => {
    setConfigureCallback(openConfigDialog)
  }, [setConfigureCallback, openConfigDialog])

  // Listen for SettingsChanged events (fired when dialog saves settings)
  useEffect(() => {
    if (!initialized) return

    const handleSettingsChanged = () => {
      console.log('[App] SettingsChanged event - reloading config from Tableau')
      const savedSettings = tableau.extensions.settings.getAll()
      let loadedConfig = JSON.parse(JSON.stringify(Config.current))

      if (savedSettings && Object.keys(savedSettings).length > 0) {
        Object.keys(savedSettings).forEach(key => {
          try {
            loadedConfig[key] = JSON.parse(savedSettings[key])
          } catch {
            loadedConfig[key] = savedSettings[key]
          }
        })
      }

      Config.current = loadedConfig
      setConfig(loadedConfig)
      console.log('[App] Config reloaded from SettingsChanged event')
    }

    tableau.extensions.settings.addEventListener(
      tableau.TableauEventType.SettingsChanged,
      handleSettingsChanged
    )

    return () => {
      tableau.extensions.settings.removeEventListener(
        tableau.TableauEventType.SettingsChanged,
        handleSettingsChanged
      )
    }
  }, [initialized])

  // Debounced save to Tableau (2 seconds after last change)
  const debouncedSaveToTableau = (configToSave) => {
    console.log('[App] Scheduling debounced save to Tableau...')

    // Clear previous timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Schedule new save
    saveTimerRef.current = setTimeout(async () => {
      console.log('[App] Executing debounced save to Tableau')
      Object.keys(configToSave).forEach(key => {
        const value = typeof configToSave[key] === 'object'
          ? JSON.stringify(configToSave[key])
          : configToSave[key]
        tableau.extensions.settings.set(key, value != null ? String(value) : '')
      })
      await tableau.extensions.settings.saveAsync()
      console.log('[App] ✓ Debounced save completed!')
      saveTimerRef.current = null
    }, 2000) // 2 second debounce
  }

  // Load saved config from Tableau settings ONCE on initial mount
  useEffect(() => {
    if (!initialized || hasLoadedInitialSettings.current) {
      return
    }

    console.log('[App] ===== INITIAL CONFIG LOAD FROM TABLEAU =====')

    const loadInitialConfig = async () => {
      const savedSettings = tableau.extensions.settings.getAll()
      let finalConfig = JSON.parse(JSON.stringify(Config.current))

      if (savedSettings && Object.keys(savedSettings).length > 0) {
        const loadedConfig = {}
        Object.keys(savedSettings).forEach(key => {
          try {
            loadedConfig[key] = JSON.parse(savedSettings[key])
          } catch {
            loadedConfig[key] = savedSettings[key]
          }
        })
        // Merge with defaults to ensure all properties exist
        finalConfig = { ...finalConfig, ...loadedConfig }
        console.log('[App] ✓ Loaded saved settings from Tableau')
      } else {
        console.log('[App] No saved settings found - using defaults')
      }

      setConfig(finalConfig)
      Config.current = finalConfig
      hasLoadedInitialSettings.current = true
      console.log('[App] ✓ Initial config loaded!')
    }

    loadInitialConfig()
  }, [initialized])

  // Update field mappings from encoding map (reads directly from marks card sections)
  useEffect(() => {
    if (!initialized || !hasLoadedInitialSettings.current) {
      return
    }

    // Only proceed if we have encoding data
    const hasEncodings = Object.keys(encodingMap).length > 0
    if (!hasEncodings) {
      console.log('[App] No encoding data yet - waiting for fields to be added')
      return
    }

    console.log('[App] ===== ENCODING MAP CHANGED =====')
    console.log('[App] Encoding map:', JSON.stringify(encodingMap))

    setConfig(prevConfig => {
      // ENCODING-BASED MAPPING: Always use marks card as the source of truth
      // encoding IDs match .trex manifest: "dimension", "bar1", "bar2", "line"
      const newDimension = encodingMap.dimension || ''
      const newBar1 = encodingMap.bar1 || ''
      const newBar2 = encodingMap.bar2 || ''
      const newLine = encodingMap.line || ''

      // Log warnings for missing encodings
      if (!newDimension) console.warn('[App] Category encoding is empty')
      if (!newBar1) console.warn('[App] Bar 1 encoding is empty')
      if (!newBar2) console.warn('[App] Bar 2 encoding is empty')
      if (!newLine) console.warn('[App] Line encoding is empty')
      if (encodingMap.detail) {
        console.warn('[App] Field in Detail section:', encodingMap.detail, '- did you mean to place it in Category, Bar 1, Bar 2, or Line?')
      }

      // Check if anything actually changed
      if (
        prevConfig.dimension === newDimension &&
        prevConfig.bar1Measure === newBar1 &&
        prevConfig.bar2Measure === newBar2 &&
        prevConfig.lineMeasure === newLine
      ) {
        console.log('[App] No mapping changes - keeping current config')
        return prevConfig
      }

      const updatedConfig = {
        ...prevConfig,
        dimension: newDimension,
        bar1Measure: newBar1,
        bar2Measure: newBar2,
        lineMeasure: newLine,
        useManualMapping: false
      }

      console.log('[App] ✓ Encoding-based mapping:')
      console.log('[App] - dimension:', newDimension)
      console.log('[App] - bar1Measure:', newBar1)
      console.log('[App] - bar2Measure:', newBar2)
      console.log('[App] - lineMeasure:', newLine)

      Config.current = updatedConfig
      debouncedSaveToTableau(updatedConfig)

      return updatedConfig
    })

    // Cleanup: Cancel pending debounced save on unmount
    return () => {
      if (saveTimerRef.current) {
        console.log('[App] Cleaning up debounced save timer')
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [encodingMap, initialized])

  if (error) {
    return <ErrorScreen error={error} onRetry={refreshData} />
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="app">
      {(config.titleShow !== false || config.showRefreshButton !== false || config.showSettingsCog !== false) && (
        <header className="app-header" style={{
          borderBottom: config.showHeaderBorder !== false
            ? `${config.separatorWidth || 1}px ${config.separatorStyle || 'solid'} ${config.separatorColor || 'var(--color-border)'}`
            : 'none',
          padding: config.titlePadding != null ? `${config.titlePadding}px 16px` : undefined,
          background: config.titleBgColor && config.titleBgColor !== 'transparent' ? config.titleBgColor : undefined
        }}>
          <div className="header-left">
            {config.titleShow !== false && (
              <h3 className="chart-title" style={{
                fontFamily: (config.titleFont?.family) || config.fontFamily || 'inherit',
                fontSize: (config.titleFont?.size || config.titleFontSize || 18) + 'px',
                fontWeight: config.titleFont?.weight || config.titleWeight || 600,
                fontStyle: config.titleFont?.italic ? 'italic' : 'normal',
                color: config.titleFont?.color || config.titleColor || 'var(--color-text)'
              }}>
                {config.titleText || 'Combo Chart'}
              </h3>
            )}
          </div>
          <div className="header-actions">
            {config.showRefreshButton !== false && (
              <button
                className="btn-icon"
                onClick={refreshData}
                title="Refresh data"
              >
                🔄
              </button>
            )}
            {config.showSettingsCog !== false && (
              <button
                className="btn-icon"
                onClick={openConfigDialog}
                title="Settings"
              >
                ⚙️
              </button>
            )}
          </div>
        </header>
      )}

      <main className="app-main">
        <ComboChart
          data={data}
          columns={columns}
          config={config}
        />
      </main>

    </div>
  )
}

export default App
