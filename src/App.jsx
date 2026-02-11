import { useState, useEffect } from 'react'
import ComboChart from './components/ComboChart'
import SettingsDialog from './components/SettingsDialog'
import DebugConsole from './components/DebugConsole'
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
    worksheet,
    refreshData
  } = useTableauExtension()

  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState(Config.current)

  // Load saved config from Tableau settings
  useEffect(() => {
    if (initialized) {
      const savedSettings = tableau.extensions.settings.getAll()
      if (savedSettings && Object.keys(savedSettings).length > 0) {
        const loadedConfig = {}
        Object.keys(savedSettings).forEach(key => {
          try {
            loadedConfig[key] = JSON.parse(savedSettings[key])
          } catch {
            loadedConfig[key] = savedSettings[key]
          }
        })
        const mergedConfig = { ...Config.current, ...loadedConfig }
        Config.current = mergedConfig
        setConfig(mergedConfig)
      }
    }
  }, [initialized])

  const handleSaveSettings = async (newConfig) => {
    // Save to Tableau settings
    Object.keys(newConfig).forEach(key => {
      const value = typeof newConfig[key] === 'object'
        ? JSON.stringify(newConfig[key])
        : newConfig[key]
      tableau.extensions.settings.set(key, value)
    })

    await tableau.extensions.settings.saveAsync()

    Config.current = newConfig
    setConfig(newConfig)
    setShowSettings(false)

    // Refresh to apply new settings
    refreshData()
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={refreshData} />
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Combo Chart</h1>
          {worksheet && (
            <span className="worksheet-name">{worksheet.name}</span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={refreshData}
            title="Refresh data"
          >
            🔄
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="app-main">
        <ComboChart
          data={data}
          columns={columns}
          config={config}
        />
      </main>

      {showSettings && (
        <SettingsDialog
          config={config}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <DebugConsole />
    </div>
  )
}

export default App
