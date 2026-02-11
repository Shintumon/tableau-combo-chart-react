import { useState } from 'react'

function SettingsDialog({ config, onSave, onClose }) {
  const [localConfig, setLocalConfig] = useState({ ...config })
  const [activeTab, setActiveTab] = useState('appearance')

  const updateConfig = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave(localConfig)
  }

  const handleReset = () => {
    setLocalConfig({ ...config })
  }

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Chart Settings</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-tabs">
          <button
            className={`tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
          <button
            className={`tab ${activeTab === 'colors' ? 'active' : ''}`}
            onClick={() => setActiveTab('colors')}
          >
            Colors
          </button>
          <button
            className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        <div className="dialog-content">
          {activeTab === 'appearance' && (
            <div className="settings-tab">
              <div className="setting-group">
                <label>
                  <span>Chart Height</span>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="200"
                      max="800"
                      value={localConfig.height}
                      onChange={(e) => updateConfig('height', parseInt(e.target.value))}
                    />
                    <span className="slider-value">{localConfig.height}px</span>
                  </div>
                </label>
              </div>

              <div className="setting-group">
                <label>
                  <span>Theme</span>
                  <select
                    value={localConfig.theme}
                    onChange={(e) => updateConfig('theme', e.target.value)}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localConfig.showLegend}
                    onChange={(e) => updateConfig('showLegend', e.target.checked)}
                  />
                  <span>Show Legend</span>
                </label>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localConfig.showGrid}
                    onChange={(e) => updateConfig('showGrid', e.target.checked)}
                  />
                  <span>Show Grid Lines</span>
                </label>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localConfig.animationEnabled}
                    onChange={(e) => updateConfig('animationEnabled', e.target.checked)}
                  />
                  <span>Enable Animations</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="settings-tab">
              <div className="setting-group">
                <label>
                  <span>Bar 1 Color</span>
                  <input
                    type="color"
                    value={localConfig.bar1Color}
                    onChange={(e) => updateConfig('bar1Color', e.target.value)}
                  />
                </label>
              </div>

              <div className="setting-group">
                <label>
                  <span>Bar 2 Color</span>
                  <input
                    type="color"
                    value={localConfig.bar2Color}
                    onChange={(e) => updateConfig('bar2Color', e.target.value)}
                  />
                </label>
              </div>

              <div className="setting-group">
                <label>
                  <span>Line Color</span>
                  <input
                    type="color"
                    value={localConfig.lineColor}
                    onChange={(e) => updateConfig('lineColor', e.target.value)}
                  />
                </label>
              </div>

              <div className="setting-group">
                <label>
                  <span>Bar Opacity</span>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={localConfig.barOpacity}
                      onChange={(e) => updateConfig('barOpacity', parseFloat(e.target.value))}
                    />
                    <span className="slider-value">{(localConfig.barOpacity * 100).toFixed(0)}%</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="settings-tab">
              <div className="setting-group">
                <label>
                  <span>Line Width</span>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={localConfig.lineWidth}
                      onChange={(e) => updateConfig('lineWidth', parseInt(e.target.value))}
                    />
                    <span className="slider-value">{localConfig.lineWidth}px</span>
                  </div>
                </label>
              </div>

              <div className="setting-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localConfig.showPoints}
                    onChange={(e) => updateConfig('showPoints', e.target.checked)}
                  />
                  <span>Show Line Points</span>
                </label>
              </div>

              {localConfig.showPoints && (
                <div className="setting-group indent">
                  <label>
                    <span>Point Radius</span>
                    <div className="slider-group">
                      <input
                        type="range"
                        min="2"
                        max="8"
                        value={localConfig.pointRadius}
                        onChange={(e) => updateConfig('pointRadius', parseInt(e.target.value))}
                      />
                      <span className="slider-value">{localConfig.pointRadius}px</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="setting-group">
                <label>
                  <span>Bar Padding</span>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={localConfig.barPadding}
                      onChange={(e) => updateConfig('barPadding', parseFloat(e.target.value))}
                    />
                    <span className="slider-value">{(localConfig.barPadding * 100).toFixed(0)}%</span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button onClick={handleReset} disabled={!hasChanges}>
            Reset
          </button>
          <div className="spacer"></div>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsDialog
