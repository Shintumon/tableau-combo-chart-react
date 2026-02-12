import { useState, useEffect, useRef, useCallback } from 'react'
import { Config } from '../utils/config'

function SettingsDialog({ config, columns = [], onSave, onApply, onClose, isDialog = false, debugLogs: externalDebugLogs, onClearDebugLogs, workbookFont }) {
  const [localConfig, setLocalConfig] = useState(() => {
    return { ...Config.current, ...config }
  })
  const [activeTab, setActiveTab] = useState('data')
  const [showDebugTab, setShowDebugTab] = useState(false)
  const [fontOptions, setFontOptions] = useState(() => Config.fontFamilies)
  const debugContentRef = useRef(null)

  // Use external debug logs from DialogApp (captures from module load)
  const debugLogs = externalDebugLogs || []

  // Auto-scroll debug content
  useEffect(() => {
    if (debugContentRef.current && activeTab === 'debug') {
      debugContentRef.current.scrollTop = debugContentRef.current.scrollHeight
    }
  }, [debugLogs, activeTab])

  // Keyboard shortcut: Ctrl+Shift+D to show debug tab
  useEffect(() => {
    if (!isDialog) return

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setShowDebugTab(prev => {
          if (!prev) {
            setActiveTab('debug')
          }
          return !prev
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDialog])

  // Load system fonts asynchronously and build the font dropdown options
  useEffect(() => {
    Config.getSystemFonts().then(systemFonts => {
      const options = []

      // Add workbook font as first option if detected
      if (workbookFont?.family) {
        const primaryName = workbookFont.family.replace(/['"]/g, '').split(',')[0].trim()
        options.push({
          value: workbookFont.family,
          label: `${primaryName} (Workbook Default)`,
          primary: primaryName,
          isDefault: true
        })
        // Separator placeholder
        options.push({ value: '__separator__', label: '───────────', disabled: true })
      }

      // Add system fonts, skipping the workbook font if it's already listed
      const wbPrimary = workbookFont?.family?.replace(/['"]/g, '').split(',')[0].trim().toLowerCase()
      systemFonts.forEach(font => {
        if (wbPrimary && font.primary.toLowerCase() === wbPrimary) return
        options.push(font)
      })

      setFontOptions(options)
    })
  }, [workbookFont])

  const updateConfig = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave(localConfig)
  }

  const handleReset = () => {
    setLocalConfig({ ...config })
  }

  const handleApplyPalette = (paletteId) => {
    const palette = Config.colorPalettes[paletteId]
    if (palette && palette.colors.length >= 3) {
      const updated = {
        ...localConfig,
        colorPalette: paletteId,
        bar1Color: palette.colors[0],
        bar2Color: palette.colors[1],
        lineColor: palette.colors[2],
        pointFill: palette.colors[2],
        bar1BorderColor: Config.darkenColor(palette.colors[0], 20),
        bar2BorderColor: Config.darkenColor(palette.colors[1], 20)
      }
      setLocalConfig(updated)
    }
  }

  // Helper to update nested font object properties
  const updateFont = (fontKey, prop, value) => {
    setLocalConfig(prev => ({
      ...prev,
      [fontKey]: { ...(prev[fontKey] || {}), [prop]: value }
    }))
  }

  // Reusable font controls component
  const FontControls = ({ fontKey, label }) => {
    const font = localConfig[fontKey] || {}
    return (
      <div className="font-controls-group">
        <div className="section-label">{label} Font</div>
        <div className="form-group indent">
          <label className="form-label">Font Family</label>
          <select
            value={font.family || ''}
            onChange={(e) => updateFont(fontKey, 'family', e.target.value)}
            style={{ fontFamily: font.family || localConfig.fontFamily }}
          >
            <option value="">Use Global Font</option>
            {fontOptions.map((f, i) => (
              f.value === '__separator__'
                ? <option key={`sep-${i}`} disabled>───────────</option>
                : <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
            ))}
          </select>
        </div>
        <div className="form-row indent">
          <div className="form-group">
            <label className="form-label">Size</label>
            <div className="slider-row">
              <input type="range" min="8" max="24" value={font.size || 12}
                onChange={(e) => updateFont(fontKey, 'size', parseInt(e.target.value))} />
              <span className="slider-val">{font.size || 12}px</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Weight</label>
            <select value={String(font.weight || 400)}
              onChange={(e) => updateFont(fontKey, 'weight', parseInt(e.target.value))}>
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi-Bold</option>
              <option value="700">Bold</option>
            </select>
          </div>
        </div>
        <div className="inline-row indent">
          <div className="color-item compact">
            <label>Color</label>
            <input type="color" value={font.color || '#666666'}
              onChange={(e) => updateFont(fontKey, 'color', e.target.value)} />
          </div>
          <label className="check-row compact">
            <input type="checkbox" checked={font.italic || false}
              onChange={(e) => updateFont(fontKey, 'italic', e.target.checked)} />
            <span>Italic</span>
          </label>
        </div>
      </div>
    )
  }

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config)

  const tabs = [
    { id: 'data', label: 'Data Mapping' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'colors', label: 'Colors' },
    { id: 'bars', label: 'Bars' },
    { id: 'line', label: 'Line & Points' },
    { id: 'axes', label: 'Axes' },
    { id: 'grid', label: 'Grid & Title' },
    { id: 'labels', label: 'Labels' },
    { id: 'legend', label: 'Legend' },
    { id: 'tooltip', label: 'Tooltip' },
    { id: 'animation', label: 'Animation' },
    ...(showDebugTab ? [{ id: 'debug', label: 'Debug' }] : [])
  ]

  // Separate dimensions and measures from columns
  const dimensions = columns.filter(col =>
    col.dataType === 'string' || col.dataType === 'date' || col.dataType === 'date-time'
  )
  const measures = columns.filter(col =>
    col.dataType === 'float' || col.dataType === 'int'
  )

  // Filter measures: exclude already-selected fields from other dropdowns
  const getAvailableMeasures = (currentField) => {
    const selectedMeasures = [
      localConfig.bar1Measure,
      localConfig.bar2Measure,
      localConfig.lineMeasure
    ].filter(f => f && f !== currentField)
    return measures.filter(m => !selectedMeasures.includes(m.fieldName))
  }

  return (
    <div className={`settings-dialog ${isDialog ? 'dialog-fullscreen' : ''}`}>
      <div className="dialog-header">
        <h2>Settings</h2>
        {!isDialog && (
          <button className="btn-close" onClick={onClose} aria-label="Close">&times;</button>
        )}
      </div>

        <div className="dialog-body">
          <nav className="dialog-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="dialog-content">
            {/* DATA MAPPING TAB */}
            {activeTab === 'data' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Data Mapping</h3>
                  <p>Map worksheet fields to chart elements</p>
                </div>

                <div className="field-grid">
                  <div className="field-card">
                    <div className="field-card-label">Category (X-Axis)</div>
                    <select
                      value={localConfig.dimension}
                      onChange={(e) => updateConfig('dimension', e.target.value)}
                    >
                      <option value="">None</option>
                      {dimensions.map(dim => (
                        <option key={dim.fieldName} value={dim.fieldName}>
                          {dim.fieldName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-card">
                    <div className="field-card-label">Bar 1 Measure</div>
                    <select
                      value={localConfig.bar1Measure}
                      onChange={(e) => updateConfig('bar1Measure', e.target.value)}
                    >
                      <option value="">None</option>
                      {getAvailableMeasures(localConfig.bar1Measure).map(m => (
                        <option key={m.fieldName} value={m.fieldName}>
                          {m.fieldName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-card">
                    <div className="field-card-label">Bar 2 Measure</div>
                    <select
                      value={localConfig.bar2Measure}
                      onChange={(e) => updateConfig('bar2Measure', e.target.value)}
                    >
                      <option value="">None</option>
                      {getAvailableMeasures(localConfig.bar2Measure).map(m => (
                        <option key={m.fieldName} value={m.fieldName}>
                          {m.fieldName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-card">
                    <div className="field-card-label">Line Measure</div>
                    <select
                      value={localConfig.lineMeasure}
                      onChange={(e) => updateConfig('lineMeasure', e.target.value)}
                    >
                      <option value="">None</option>
                      {getAvailableMeasures(localConfig.lineMeasure).map(m => (
                        <option key={m.fieldName} value={m.fieldName}>
                          {m.fieldName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {localConfig.useManualMapping && (
                  <div className="info-banner warning">
                    <div className="info-banner-content">
                      <strong>Manual override</strong>
                      <span>Chart mappings differ from the marks card. These changes only affect what the chart renders, not the marks card itself.</span>
                    </div>
                    <button
                      className="btn-text"
                      onClick={() => {
                        setLocalConfig(prev => ({ ...prev, useManualMapping: false }))
                        console.log('[Settings] Reset to encoding-based mode')
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}

                {/* Show unmapped fields hint */}
                {(() => {
                  const unmapped = []
                  if (!localConfig.dimension) unmapped.push('Category')
                  if (!localConfig.bar1Measure) unmapped.push('Bar 1')
                  if (!localConfig.bar2Measure) unmapped.push('Bar 2')
                  if (!localConfig.lineMeasure) unmapped.push('Line')
                  if (unmapped.length > 0 && unmapped.length < 4) {
                    return (
                      <div className="info-banner info">
                        <div className="info-banner-content">
                          <span>{unmapped.join(', ')} {unmapped.length === 1 ? 'is' : 'are'} not mapped. Add {unmapped.length === 1 ? 'a field' : 'fields'} to the marks card or select {unmapped.length === 1 ? 'one' : 'them'} below.</span>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Appearance</h3>
                  <p>General chart layout and style</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Chart Height</label>
                  <div className="slider-row">
                    <input
                      type="range" min="200" max="800"
                      value={localConfig.height}
                      onChange={(e) => updateConfig('height', parseInt(e.target.value))}
                    />
                    <span className="slider-val">{localConfig.height}px</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Theme</label>
                  <select
                    value={localConfig.theme}
                    onChange={(e) => updateConfig('theme', e.target.value)}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Bar Style</label>
                  <select
                    value={localConfig.barStyle}
                    onChange={(e) => updateConfig('barStyle', e.target.value)}
                  >
                    <option value="grouped">Grouped</option>
                    <option value="stacked">Stacked</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Axis Mode</label>
                  <select
                    value={localConfig.axisMode}
                    onChange={(e) => updateConfig('axisMode', e.target.value)}
                  >
                    <option value="dual">Dual Axis</option>
                    <option value="shared">Shared Axis</option>
                  </select>
                  <p className="help-text">
                    {localConfig.axisMode === 'dual'
                      ? 'Bars use the left Y-axis, line uses an independent right Y-axis. Best when measures have different scales.'
                      : 'All measures share a single left Y-axis. Best when measures have similar ranges.'}
                  </p>
                </div>

                {localConfig.axisMode === 'dual' && (
                  <label className="check-row indent">
                    <input type="checkbox" checked={localConfig.syncDualAxis}
                      onChange={(e) => updateConfig('syncDualAxis', e.target.checked)} />
                    <span>Sync Dual Axis Scales</span>
                  </label>
                )}

                <div className="divider" />
                <div className="section-label">Typography</div>

                <div className="form-group">
                  <label className="form-label">Font Family</label>
                  <select
                    value={localConfig.fontFamily}
                    onChange={(e) => updateConfig('fontFamily', e.target.value)}
                    style={{ fontFamily: localConfig.fontFamily }}
                  >
                    {fontOptions.map((f, i) => (
                      f.value === '__separator__'
                        ? <option key={`sep-${i}`} disabled>───────────</option>
                        : <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                            {f.label}
                          </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Title Weight</label>
                    <select value={String(localConfig.titleWeight)}
                      onChange={(e) => updateConfig('titleWeight', e.target.value)}>
                      <option value="400">Normal (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">Semi-Bold (600)</option>
                      <option value="700">Bold (700)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Label Weight</label>
                    <select value={String(localConfig.labelWeight)}
                      onChange={(e) => updateConfig('labelWeight', e.target.value)}>
                      <option value="300">Light (300)</option>
                      <option value="400">Normal (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">Semi-Bold (600)</option>
                    </select>
                  </div>
                </div>

                <div className="font-preview" style={{ fontFamily: localConfig.fontFamily }}>
                  <div className="preview-title" style={{ fontWeight: localConfig.titleWeight }}>Preview Title</div>
                  <div className="preview-label" style={{ fontWeight: localConfig.labelWeight }}>Axis labels and legend text</div>
                </div>

                <div className="divider" />
                <div className="section-label">Dashboard Controls</div>
                <p className="help-text">Control visibility of header buttons when embedded in a dashboard.</p>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showSettingsCog}
                    onChange={(e) => updateConfig('showSettingsCog', e.target.checked)} />
                  <span>Show Settings Button</span>
                </label>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showRefreshButton}
                    onChange={(e) => updateConfig('showRefreshButton', e.target.checked)} />
                  <span>Show Refresh Button</span>
                </label>

                <div className="divider" />
                <div className="section-label">Chart Separators</div>
                <p className="help-text">Control the border lines between chart sections.</p>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showHeaderBorder}
                    onChange={(e) => updateConfig('showHeaderBorder', e.target.checked)} />
                  <span>Show Header Border</span>
                </label>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showLegendBorder}
                    onChange={(e) => updateConfig('showLegendBorder', e.target.checked)} />
                  <span>Show Legend Border</span>
                </label>
              </div>
            )}

            {/* COLORS TAB */}
            {activeTab === 'colors' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Colors</h3>
                  <p>Color palette and individual colors</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Color Palette</label>
                  <select
                    value={localConfig.colorPalette}
                    onChange={(e) => handleApplyPalette(e.target.value)}
                  >
                    {Object.entries(Config.colorPalettes).map(([id, palette]) => (
                      <option key={id} value={id}>{palette.name}</option>
                    ))}
                  </select>
                </div>

                <div className="palette-preview">
                  {Config.colorPalettes[localConfig.colorPalette].colors.map((color, i) => (
                    <div key={i} className="palette-swatch" style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>

                <div className="divider" />

                <div className="color-grid">
                  <div className="color-item">
                    <label>Bar 1</label>
                    <input type="color" value={localConfig.bar1Color}
                      onChange={(e) => updateConfig('bar1Color', e.target.value)} />
                  </div>
                  <div className="color-item">
                    <label>Bar 2</label>
                    <input type="color" value={localConfig.bar2Color}
                      onChange={(e) => updateConfig('bar2Color', e.target.value)} />
                  </div>
                  <div className="color-item">
                    <label>Line</label>
                    <input type="color" value={localConfig.lineColor}
                      onChange={(e) => updateConfig('lineColor', e.target.value)} />
                  </div>
                </div>

                <div className="divider" />

                {[
                  ['bar1Opacity', 'Bar 1 Opacity'],
                  ['bar2Opacity', 'Bar 2 Opacity'],
                  ['lineOpacity', 'Line Opacity']
                ].map(([key, label]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{label}</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="1" step="0.1"
                        value={localConfig[key]}
                        onChange={(e) => updateConfig(key, parseFloat(e.target.value))} />
                      <span className="slider-val">{(localConfig[key] * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BARS TAB */}
            {activeTab === 'bars' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Bars</h3>
                  <p>Bar spacing, borders and corners</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Bar Padding</label>
                  <div className="slider-row">
                    <input type="range" min="0" max="0.5" step="0.05"
                      value={localConfig.barPadding}
                      onChange={(e) => updateConfig('barPadding', parseFloat(e.target.value))} />
                    <span className="slider-val">{(localConfig.barPadding * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {localConfig.barStyle === 'grouped' && (
                  <div className="form-group">
                    <label className="form-label">Bar Gap</label>
                    <div className="slider-row">
                      <input type="range" min="0" max="20"
                        value={localConfig.barGap}
                        onChange={(e) => updateConfig('barGap', parseInt(e.target.value))} />
                      <span className="slider-val">{localConfig.barGap}px</span>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Bar Width</label>
                  <div className="slider-row">
                    <input type="range" min="20" max="100"
                      value={localConfig.barWidth}
                      onChange={(e) => updateConfig('barWidth', parseInt(e.target.value))} />
                    <span className="slider-val">{localConfig.barWidth}%</span>
                  </div>
                </div>

                <div className="section-label">Bar 1</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.bar1ShowBorder}
                    onChange={(e) => updateConfig('bar1ShowBorder', e.target.checked)} />
                  <span>Show Border</span>
                </label>
                {localConfig.bar1ShowBorder && (
                  <div className="inline-row indent">
                    <div className="color-item compact">
                      <label>Color</label>
                      <input type="color" value={localConfig.bar1BorderColor}
                        onChange={(e) => updateConfig('bar1BorderColor', e.target.value)} />
                    </div>
                    <div className="form-group compact">
                      <label className="form-label">Width</label>
                      <div className="slider-row">
                        <input type="range" min="1" max="5" value={localConfig.bar1BorderWidth}
                          onChange={(e) => updateConfig('bar1BorderWidth', parseInt(e.target.value))} />
                        <span className="slider-val">{localConfig.bar1BorderWidth}px</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Corner Radius</label>
                  <div className="slider-row">
                    <input type="range" min="0" max="10" value={localConfig.bar1CornerRadius}
                      onChange={(e) => updateConfig('bar1CornerRadius', parseInt(e.target.value))} />
                    <span className="slider-val">{localConfig.bar1CornerRadius}px</span>
                  </div>
                </div>

                <div className="section-label">Bar 2</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.bar2ShowBorder}
                    onChange={(e) => updateConfig('bar2ShowBorder', e.target.checked)} />
                  <span>Show Border</span>
                </label>
                {localConfig.bar2ShowBorder && (
                  <div className="inline-row indent">
                    <div className="color-item compact">
                      <label>Color</label>
                      <input type="color" value={localConfig.bar2BorderColor}
                        onChange={(e) => updateConfig('bar2BorderColor', e.target.value)} />
                    </div>
                    <div className="form-group compact">
                      <label className="form-label">Width</label>
                      <div className="slider-row">
                        <input type="range" min="1" max="5" value={localConfig.bar2BorderWidth}
                          onChange={(e) => updateConfig('bar2BorderWidth', parseInt(e.target.value))} />
                        <span className="slider-val">{localConfig.bar2BorderWidth}px</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Corner Radius</label>
                  <div className="slider-row">
                    <input type="range" min="0" max="10" value={localConfig.bar2CornerRadius}
                      onChange={(e) => updateConfig('bar2CornerRadius', parseInt(e.target.value))} />
                    <span className="slider-val">{localConfig.bar2CornerRadius}px</span>
                  </div>
                </div>
              </div>
            )}

            {/* LINE & POINTS TAB */}
            {activeTab === 'line' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Line & Points</h3>
                  <p>Line style and data point markers</p>
                </div>

                <div className="section-label">Line</div>

                <div className="form-group">
                  <label className="form-label">Width</label>
                  <div className="slider-row">
                    <input type="range" min="1" max="10" value={localConfig.lineWidth}
                      onChange={(e) => updateConfig('lineWidth', parseInt(e.target.value))} />
                    <span className="slider-val">{localConfig.lineWidth}px</span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Style</label>
                    <select value={localConfig.lineStyle}
                      onChange={(e) => updateConfig('lineStyle', e.target.value)}>
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Curve</label>
                    <select value={localConfig.lineCurve}
                      onChange={(e) => updateConfig('lineCurve', e.target.value)}>
                      <option value="linear">Linear</option>
                      <option value="monotone">Monotone</option>
                      <option value="cardinal">Cardinal</option>
                      <option value="step">Step</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Vertical Position</label>
                  <select value={localConfig.lineVerticalPosition}
                    onChange={(e) => updateConfig('lineVerticalPosition', e.target.value)}>
                    <option value="auto">Auto</option>
                    <option value="top">Top</option>
                    <option value="upper">Upper</option>
                    <option value="middle">Middle</option>
                    <option value="lower">Lower</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>

                <div className="section-label">Points</div>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showPoints}
                    onChange={(e) => updateConfig('showPoints', e.target.checked)} />
                  <span>Show Line Points</span>
                </label>

                {localConfig.showPoints && (
                  <>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Shape</label>
                        <select value={localConfig.pointShape}
                          onChange={(e) => updateConfig('pointShape', e.target.value)}>
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                          <option value="diamond">Diamond</option>
                          <option value="triangle">Triangle</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Size</label>
                        <div className="slider-row">
                          <input type="range" min="2" max="15" value={localConfig.pointSize}
                            onChange={(e) => updateConfig('pointSize', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.pointSize}px</span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-row indent">
                      <div className="color-item compact">
                        <label>Fill</label>
                        <input type="color" value={localConfig.pointFill}
                          onChange={(e) => updateConfig('pointFill', e.target.value)} />
                      </div>
                      <div className="color-item compact">
                        <label>Stroke</label>
                        <input type="color" value={localConfig.pointStroke}
                          onChange={(e) => updateConfig('pointStroke', e.target.value)} />
                      </div>
                      <div className="form-group compact">
                        <label className="form-label">Stroke Width</label>
                        <div className="slider-row">
                          <input type="range" min="0" max="5" value={localConfig.pointStrokeWidth}
                            onChange={(e) => updateConfig('pointStrokeWidth', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.pointStrokeWidth}px</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AXES TAB */}
            {activeTab === 'axes' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Axes</h3>
                  <p>Axis visibility, labels and range</p>
                </div>

                <div className="section-label">X Axis</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.xAxisShow}
                    onChange={(e) => updateConfig('xAxisShow', e.target.checked)} />
                  <span>Show X Axis</span>
                </label>

                {localConfig.xAxisShow && (
                  <>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.xAxisShowTitle}
                        onChange={(e) => updateConfig('xAxisShowTitle', e.target.checked)} />
                      <span>Show Title</span>
                    </label>
                    {localConfig.xAxisShowTitle && (
                      <div className="form-group indent">
                        <input type="text" value={localConfig.xAxisTitle} placeholder="Auto"
                          onChange={(e) => updateConfig('xAxisTitle', e.target.value)} />
                      </div>
                    )}
                    <div className="form-group indent">
                      <label className="form-label">Label Rotation</label>
                      <div className="slider-row">
                        <input type="range" min="-90" max="90" value={localConfig.xAxisRotation}
                          onChange={(e) => updateConfig('xAxisRotation', parseInt(e.target.value))} />
                        <span className="slider-val">{localConfig.xAxisRotation}&deg;</span>
                      </div>
                    </div>
                    <div className="check-group indent">
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.xAxisShowLabels}
                          onChange={(e) => updateConfig('xAxisShowLabels', e.target.checked)} />
                        <span>Labels</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.xAxisShowTickMarks}
                          onChange={(e) => updateConfig('xAxisShowTickMarks', e.target.checked)} />
                        <span>Tick Marks</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.xAxisShowAxisLine}
                          onChange={(e) => updateConfig('xAxisShowAxisLine', e.target.checked)} />
                        <span>Axis Line</span>
                      </label>
                    </div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Sort Order</label>
                        <select value={localConfig.xAxisSort}
                          onChange={(e) => updateConfig('xAxisSort', e.target.value)}>
                          <option value="default">Default</option>
                          <option value="asc">A → Z</option>
                          <option value="desc">Z → A</option>
                          <option value="reverse">Reverse</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Alignment</label>
                        <select value={localConfig.xAxisAlign}
                          onChange={(e) => updateConfig('xAxisAlign', e.target.value)}>
                          <option value="center">Center</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                    <div className="inline-row indent">
                      <div className="color-item compact">
                        <label>Tick Color</label>
                        <input type="color" value={localConfig.xAxisTickColor}
                          onChange={(e) => updateConfig('xAxisTickColor', e.target.value)} />
                      </div>
                      <div className="color-item compact">
                        <label>Line Color</label>
                        <input type="color" value={localConfig.xAxisLineColor}
                          onChange={(e) => updateConfig('xAxisLineColor', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Label Offset X</label>
                        <div className="slider-row">
                          <input type="range" min="-20" max="20" value={localConfig.xAxisLabelOffsetX}
                            onChange={(e) => updateConfig('xAxisLabelOffsetX', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.xAxisLabelOffsetX}px</span>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Label Offset Y</label>
                        <div className="slider-row">
                          <input type="range" min="-20" max="30" value={localConfig.xAxisLabelOffsetY}
                            onChange={(e) => updateConfig('xAxisLabelOffsetY', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.xAxisLabelOffsetY}px</span>
                        </div>
                      </div>
                    </div>
                    <FontControls fontKey="xAxisFont" label="X Axis" />
                  </>
                )}

                <div className="section-label">Y Axis Left (Bars)</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.yAxisLeftShow}
                    onChange={(e) => updateConfig('yAxisLeftShow', e.target.checked)} />
                  <span>Show Y Axis Left</span>
                </label>
                {localConfig.yAxisLeftShow && (
                  <>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisLeftShowTitle}
                        onChange={(e) => updateConfig('yAxisLeftShowTitle', e.target.checked)} />
                      <span>Show Title</span>
                    </label>
                    {localConfig.yAxisLeftShowTitle && (
                      <div className="form-group indent">
                        <input type="text" value={localConfig.yAxisLeftTitle} placeholder="Auto"
                          onChange={(e) => updateConfig('yAxisLeftTitle', e.target.value)} />
                      </div>
                    )}
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Min</label>
                        <input type="number" value={localConfig.yAxisLeftMin || ''} placeholder="Auto"
                          onChange={(e) => updateConfig('yAxisLeftMin', e.target.value ? parseFloat(e.target.value) : null)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Max</label>
                        <input type="number" value={localConfig.yAxisLeftMax || ''} placeholder="Auto"
                          onChange={(e) => updateConfig('yAxisLeftMax', e.target.value ? parseFloat(e.target.value) : null)} />
                      </div>
                    </div>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisLeftIncludeZero}
                        onChange={(e) => updateConfig('yAxisLeftIncludeZero', e.target.checked)} />
                      <span>Include Zero</span>
                    </label>
                    <div className="check-group indent">
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.yAxisLeftShowLabels}
                          onChange={(e) => updateConfig('yAxisLeftShowLabels', e.target.checked)} />
                        <span>Labels</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.yAxisLeftShowTickMarks}
                          onChange={(e) => updateConfig('yAxisLeftShowTickMarks', e.target.checked)} />
                        <span>Tick Marks</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.yAxisLeftShowAxisLine}
                          onChange={(e) => updateConfig('yAxisLeftShowAxisLine', e.target.checked)} />
                        <span>Axis Line</span>
                      </label>
                    </div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Label Format</label>
                        <select value={localConfig.yAxisLeftFormat}
                          onChange={(e) => updateConfig('yAxisLeftFormat', e.target.value)}>
                          <option value="auto">Auto</option>
                          <option value="number">Number</option>
                          <option value="currency">Currency</option>
                          <option value="percent">Percent</option>
                          <option value="compact">Compact (K/M/B)</option>
                        </select>
                      </div>
                      {localConfig.yAxisLeftFormat !== 'auto' && (
                        <div className="form-group">
                          <label className="form-label">Decimals</label>
                          <div className="slider-row">
                            <input type="range" min="0" max="4" value={localConfig.yAxisLeftDecimals}
                              onChange={(e) => updateConfig('yAxisLeftDecimals', parseInt(e.target.value))} />
                            <span className="slider-val">{localConfig.yAxisLeftDecimals}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {localConfig.yAxisLeftFormat === 'currency' && (
                      <div className="form-group indent">
                        <label className="form-label">Currency Symbol</label>
                        <input type="text" value={localConfig.yAxisLeftCurrencySymbol} style={{ width: 60 }}
                          onChange={(e) => updateConfig('yAxisLeftCurrencySymbol', e.target.value)} />
                      </div>
                    )}
                    <div className="inline-row indent">
                      <div className="color-item compact">
                        <label>Tick Color</label>
                        <input type="color" value={localConfig.yAxisLeftTickColor}
                          onChange={(e) => updateConfig('yAxisLeftTickColor', e.target.value)} />
                      </div>
                      <div className="color-item compact">
                        <label>Line Color</label>
                        <input type="color" value={localConfig.yAxisLeftLineColor}
                          onChange={(e) => updateConfig('yAxisLeftLineColor', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Label Offset X</label>
                        <div className="slider-row">
                          <input type="range" min="-20" max="20" value={localConfig.yAxisLeftLabelOffsetX}
                            onChange={(e) => updateConfig('yAxisLeftLabelOffsetX', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.yAxisLeftLabelOffsetX}px</span>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Label Offset Y</label>
                        <div className="slider-row">
                          <input type="range" min="-20" max="20" value={localConfig.yAxisLeftLabelOffsetY}
                            onChange={(e) => updateConfig('yAxisLeftLabelOffsetY', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.yAxisLeftLabelOffsetY}px</span>
                        </div>
                      </div>
                    </div>
                    <FontControls fontKey="yAxisLeftFont" label="Y Left Axis" />
                  </>
                )}

                <div className="section-label">Y Axis Right (Line)</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.yAxisRightShow}
                    onChange={(e) => updateConfig('yAxisRightShow', e.target.checked)} />
                  <span>Show Y Axis Right</span>
                </label>
                {localConfig.yAxisRightShow && (
                  <>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisRightShowTitle}
                        onChange={(e) => updateConfig('yAxisRightShowTitle', e.target.checked)} />
                      <span>Show Title</span>
                    </label>
                    {localConfig.yAxisRightShowTitle && (
                      <div className="form-group indent">
                        <input type="text" value={localConfig.yAxisRightTitle} placeholder="Auto"
                          onChange={(e) => updateConfig('yAxisRightTitle', e.target.value)} />
                      </div>
                    )}
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Min</label>
                        <input type="number" value={localConfig.yAxisRightMin || ''} placeholder="Auto"
                          onChange={(e) => updateConfig('yAxisRightMin', e.target.value ? parseFloat(e.target.value) : null)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Max</label>
                        <input type="number" value={localConfig.yAxisRightMax || ''} placeholder="Auto"
                          onChange={(e) => updateConfig('yAxisRightMax', e.target.value ? parseFloat(e.target.value) : null)} />
                      </div>
                    </div>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisRightIncludeZero}
                        onChange={(e) => updateConfig('yAxisRightIncludeZero', e.target.checked)} />
                      <span>Include Zero</span>
                    </label>
                    <div className="check-group indent">
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.yAxisRightShowLabels}
                          onChange={(e) => updateConfig('yAxisRightShowLabels', e.target.checked)} />
                        <span>Labels</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.yAxisRightShowTickMarks}
                          onChange={(e) => updateConfig('yAxisRightShowTickMarks', e.target.checked)} />
                        <span>Tick Marks</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.yAxisRightShowAxisLine}
                          onChange={(e) => updateConfig('yAxisRightShowAxisLine', e.target.checked)} />
                        <span>Axis Line</span>
                      </label>
                    </div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Label Format</label>
                        <select value={localConfig.yAxisRightFormat}
                          onChange={(e) => updateConfig('yAxisRightFormat', e.target.value)}>
                          <option value="auto">Auto</option>
                          <option value="number">Number</option>
                          <option value="currency">Currency</option>
                          <option value="percent">Percent</option>
                          <option value="compact">Compact (K/M/B)</option>
                        </select>
                      </div>
                      {localConfig.yAxisRightFormat !== 'auto' && (
                        <div className="form-group">
                          <label className="form-label">Decimals</label>
                          <div className="slider-row">
                            <input type="range" min="0" max="4" value={localConfig.yAxisRightDecimals}
                              onChange={(e) => updateConfig('yAxisRightDecimals', parseInt(e.target.value))} />
                            <span className="slider-val">{localConfig.yAxisRightDecimals}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {localConfig.yAxisRightFormat === 'currency' && (
                      <div className="form-group indent">
                        <label className="form-label">Currency Symbol</label>
                        <input type="text" value={localConfig.yAxisRightCurrencySymbol} style={{ width: 60 }}
                          onChange={(e) => updateConfig('yAxisRightCurrencySymbol', e.target.value)} />
                      </div>
                    )}
                    <div className="inline-row indent">
                      <div className="color-item compact">
                        <label>Tick Color</label>
                        <input type="color" value={localConfig.yAxisRightTickColor}
                          onChange={(e) => updateConfig('yAxisRightTickColor', e.target.value)} />
                      </div>
                      <div className="color-item compact">
                        <label>Line Color</label>
                        <input type="color" value={localConfig.yAxisRightLineColor}
                          onChange={(e) => updateConfig('yAxisRightLineColor', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Label Offset X</label>
                        <div className="slider-row">
                          <input type="range" min="-20" max="20" value={localConfig.yAxisRightLabelOffsetX}
                            onChange={(e) => updateConfig('yAxisRightLabelOffsetX', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.yAxisRightLabelOffsetX}px</span>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Label Offset Y</label>
                        <div className="slider-row">
                          <input type="range" min="-20" max="20" value={localConfig.yAxisRightLabelOffsetY}
                            onChange={(e) => updateConfig('yAxisRightLabelOffsetY', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.yAxisRightLabelOffsetY}px</span>
                        </div>
                      </div>
                    </div>
                    <FontControls fontKey="yAxisRightFont" label="Y Right Axis" />
                  </>
                )}
              </div>
            )}

            {/* GRID & TITLE TAB */}
            {activeTab === 'grid' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Grid & Title</h3>
                  <p>Chart title and grid lines</p>
                </div>

                <div className="section-label">Title</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.titleShow}
                    onChange={(e) => updateConfig('titleShow', e.target.checked)} />
                  <span>Show Title</span>
                </label>
                {localConfig.titleShow && (
                  <>
                    <div className="form-group indent">
                      <label className="form-label">Text</label>
                      <input type="text" value={localConfig.titleText}
                        onChange={(e) => updateConfig('titleText', e.target.value)} />
                    </div>
                    <div className="inline-row indent">
                      <div className="form-group compact">
                        <label className="form-label">Font Size</label>
                        <div className="slider-row">
                          <input type="range" min="10" max="36" value={localConfig.titleFontSize}
                            onChange={(e) => updateConfig('titleFontSize', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.titleFontSize}px</span>
                        </div>
                      </div>
                      <div className="color-item compact">
                        <label>Color</label>
                        <input type="color" value={localConfig.titleColor}
                          onChange={(e) => updateConfig('titleColor', e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="section-label">Grid</div>
                <div className="check-group">
                  <label className="check-row">
                    <input type="checkbox" checked={localConfig.gridHorizontal}
                      onChange={(e) => updateConfig('gridHorizontal', e.target.checked)} />
                    <span>Horizontal Lines</span>
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={localConfig.gridVertical}
                      onChange={(e) => updateConfig('gridVertical', e.target.checked)} />
                    <span>Vertical Lines</span>
                  </label>
                </div>
                {(localConfig.gridHorizontal || localConfig.gridVertical) && (
                  <div className="inline-row indent">
                    <div className="color-item compact">
                      <label>Color</label>
                      <input type="color" value={localConfig.gridColor}
                        onChange={(e) => updateConfig('gridColor', e.target.value)} />
                    </div>
                    <div className="form-group compact">
                      <label className="form-label">Opacity</label>
                      <div className="slider-row">
                        <input type="range" min="0" max="1" step="0.1" value={localConfig.gridOpacity}
                          onChange={(e) => updateConfig('gridOpacity', parseFloat(e.target.value))} />
                        <span className="slider-val">{(localConfig.gridOpacity * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LABELS TAB */}
            {activeTab === 'labels' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Labels</h3>
                  <p>Data labels for bars and line</p>
                </div>

                <div className="section-label">Bar Labels</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.barLabelsShow}
                    onChange={(e) => updateConfig('barLabelsShow', e.target.checked)} />
                  <span>Show Bar Labels</span>
                </label>
                {localConfig.barLabelsShow && (
                  <>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Position</label>
                        <select value={localConfig.barLabelsPosition}
                          onChange={(e) => updateConfig('barLabelsPosition', e.target.value)}>
                          <option value="top">Top</option>
                          <option value="inside">Inside</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Font Size</label>
                        <div className="slider-row">
                          <input type="range" min="8" max="24" value={localConfig.barLabelsFontSize}
                            onChange={(e) => updateConfig('barLabelsFontSize', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.barLabelsFontSize}px</span>
                        </div>
                      </div>
                    </div>
                    <div className="color-item compact indent">
                      <label>Color</label>
                      <input type="color" value={localConfig.barLabelsColor}
                        onChange={(e) => updateConfig('barLabelsColor', e.target.value)} />
                    </div>
                    <FontControls fontKey="bar1LabelFont" label="Bar 1 Label" />
                    <FontControls fontKey="bar2LabelFont" label="Bar 2 Label" />
                  </>
                )}

                <div className="section-label">Line Labels</div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.lineLabelsShow}
                    onChange={(e) => updateConfig('lineLabelsShow', e.target.checked)} />
                  <span>Show Line Labels</span>
                </label>
                {localConfig.lineLabelsShow && (
                  <>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Position</label>
                        <select value={localConfig.lineLabelsPosition}
                          onChange={(e) => updateConfig('lineLabelsPosition', e.target.value)}>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Font Size</label>
                        <div className="slider-row">
                          <input type="range" min="8" max="24" value={localConfig.lineLabelsFontSize}
                            onChange={(e) => updateConfig('lineLabelsFontSize', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.lineLabelsFontSize}px</span>
                        </div>
                      </div>
                    </div>
                    <div className="color-item compact indent">
                      <label>Color</label>
                      <input type="color" value={localConfig.lineLabelsColor}
                        onChange={(e) => updateConfig('lineLabelsColor', e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* LEGEND TAB */}
            {activeTab === 'legend' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Legend</h3>
                  <p>Legend position and custom labels</p>
                </div>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showLegend}
                    onChange={(e) => updateConfig('showLegend', e.target.checked)} />
                  <span>Show Legend</span>
                </label>

                {localConfig.showLegend && (
                  <>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Position</label>
                        <select value={localConfig.legendPosition}
                          onChange={(e) => updateConfig('legendPosition', e.target.value)}>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Alignment</label>
                        <select value={localConfig.legendAlign}
                          onChange={(e) => updateConfig('legendAlign', e.target.value)}>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>

                    <div className="section-label">Custom Labels</div>
                    <div className="form-group indent">
                      <label className="form-label">Bar 1</label>
                      <input type="text" value={localConfig.legendBar1Label} placeholder="Use measure name"
                        onChange={(e) => updateConfig('legendBar1Label', e.target.value)} />
                    </div>
                    <div className="form-group indent">
                      <label className="form-label">Bar 2</label>
                      <input type="text" value={localConfig.legendBar2Label} placeholder="Use measure name"
                        onChange={(e) => updateConfig('legendBar2Label', e.target.value)} />
                    </div>
                    <div className="form-group indent">
                      <label className="form-label">Line</label>
                      <input type="text" value={localConfig.legendLineLabel} placeholder="Use measure name"
                        onChange={(e) => updateConfig('legendLineLabel', e.target.value)} />
                    </div>
                    <FontControls fontKey="legendFont" label="Legend" />
                  </>
                )}
              </div>
            )}

            {/* TOOLTIP TAB */}
            {activeTab === 'tooltip' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Tooltip</h3>
                  <p>Hover tooltip content and styling</p>
                </div>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.tooltipShow}
                    onChange={(e) => updateConfig('tooltipShow', e.target.checked)} />
                  <span>Show Tooltips</span>
                </label>

                {localConfig.tooltipShow && (
                  <>
                    <div className="check-group indent">
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.tooltipShowDimension}
                          onChange={(e) => updateConfig('tooltipShowDimension', e.target.checked)} />
                        <span>Dimension</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.tooltipShowMeasureName}
                          onChange={(e) => updateConfig('tooltipShowMeasureName', e.target.checked)} />
                        <span>Measure Name</span>
                      </label>
                      <label className="check-row">
                        <input type="checkbox" checked={localConfig.tooltipShowValue}
                          onChange={(e) => updateConfig('tooltipShowValue', e.target.checked)} />
                        <span>Value</span>
                      </label>
                    </div>

                    <div className="inline-row indent">
                      <div className="color-item compact">
                        <label>Background</label>
                        <input type="color" value={localConfig.tooltipBgColor}
                          onChange={(e) => updateConfig('tooltipBgColor', e.target.value)} />
                      </div>
                      <div className="color-item compact">
                        <label>Text</label>
                        <input type="color" value={localConfig.tooltipTextColor}
                          onChange={(e) => updateConfig('tooltipTextColor', e.target.value)} />
                      </div>
                      <div className="form-group compact">
                        <label className="form-label">Font Size</label>
                        <div className="slider-row">
                          <input type="range" min="8" max="18" value={localConfig.tooltipFontSize}
                            onChange={(e) => updateConfig('tooltipFontSize', parseInt(e.target.value))} />
                          <span className="slider-val">{localConfig.tooltipFontSize}px</span>
                        </div>
                      </div>
                    </div>
                    <FontControls fontKey="tooltipFont" label="Tooltip" />
                  </>
                )}
              </div>
            )}

            {/* ANIMATION TAB */}
            {activeTab === 'animation' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Animation</h3>
                  <p>Transition effects and timing</p>
                </div>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.animationEnabled}
                    onChange={(e) => updateConfig('animationEnabled', e.target.checked)} />
                  <span>Enable Animations</span>
                </label>

                {localConfig.animationEnabled && (
                  <>
                    <div className="form-group indent">
                      <label className="form-label">Duration</label>
                      <div className="slider-row">
                        <input type="range" min="100" max="2000" step="100"
                          value={localConfig.animationDuration}
                          onChange={(e) => updateConfig('animationDuration', parseInt(e.target.value))} />
                        <span className="slider-val">{localConfig.animationDuration}ms</span>
                      </div>
                    </div>
                    <div className="form-group indent">
                      <label className="form-label">Easing</label>
                      <select value={localConfig.animationEasing}
                        onChange={(e) => updateConfig('animationEasing', e.target.value)}>
                        <option value="easeLinear">Linear</option>
                        <option value="easeCubicOut">Cubic Out</option>
                        <option value="easeCubicInOut">Cubic In-Out</option>
                        <option value="easeElastic">Elastic</option>
                        <option value="easeBounce">Bounce</option>
                        <option value="easeBack">Back</option>
                        <option value="easeQuad">Quadratic</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* DEBUG TAB (hidden until Ctrl+Shift+D) */}
            {activeTab === 'debug' && showDebugTab && (
              <div className="settings-tab debug-tab">
                <div className="tab-header">
                  <h3>Debug Console</h3>
                  <p>Press Ctrl+Shift+D to toggle</p>
                </div>

                <div className="debug-tab-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setShowDebugTab(false)
                      setActiveTab('data')
                    }}
                  >
                    Hide
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => onClearDebugLogs && onClearDebugLogs()}
                  >
                    Clear
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      const text = debugLogs.map(l =>
                        `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`
                      ).join('\n')
                      if (!text) return
                      try {
                        const textarea = document.createElement('textarea')
                        textarea.value = text
                        textarea.style.position = 'fixed'
                        textarea.style.left = '-9999px'
                        document.body.appendChild(textarea)
                        textarea.select()
                        document.execCommand('copy')
                        document.body.removeChild(textarea)
                        console.info('Logs copied to clipboard')
                      } catch {
                        console.warn('Copy failed')
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>

                <div className="debug-tab-content" ref={debugContentRef}>
                  {debugLogs.map((log, i) => (
                    <div key={i} className={`debug-log debug-${log.type}`}>
                      <span className="debug-time">[{log.timestamp}]</span>
                      <span className="debug-type">{log.type}</span>
                      <span className="debug-message">{log.message}</span>
                    </div>
                  ))}
                  {debugLogs.length === 0 && (
                    <div className="debug-empty">No logs yet...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleReset} disabled={!hasChanges}>Reset</button>
          <div className="spacer" />
          {onApply && (
            <button className="btn-secondary" onClick={() => onApply(localConfig)} disabled={!hasChanges}>Apply</button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
  )
}

export default SettingsDialog
