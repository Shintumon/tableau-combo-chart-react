import { useState, useEffect, useRef } from 'react'
import { Config } from '../utils/config'
import FormatControls from './FormatControls'
import { cleanFieldName, getDisplayName, getFieldNames } from '../utils/displayNames'

function SettingsDialog({ config, columns = [], onSave, onApply, onClose, isDialog = false, debugLogs: externalDebugLogs, onClearDebugLogs, workbookFont }) {
  const [localConfig, setLocalConfig] = useState(() => {
    return { ...Config.current, ...config }
  })
  const [activeTab, setActiveTab] = useState('data')
  const [showDebugTab, setShowDebugTab] = useState(false)
  const [fontOptions, setFontOptions] = useState(() => Config.fontFamilies)
  const debugContentRef = useRef(null)

  const debugLogs = externalDebugLogs || []

  useEffect(() => {
    if (debugContentRef.current && activeTab === 'debug') {
      debugContentRef.current.scrollTop = debugContentRef.current.scrollHeight
    }
  }, [debugLogs, activeTab])

  useEffect(() => {
    if (!isDialog) return
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setShowDebugTab(prev => {
          if (!prev) setActiveTab('debug')
          return !prev
        })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDialog])

  useEffect(() => {
    Config.getSystemFonts().then(systemFonts => {
      const options = []
      if (workbookFont?.family) {
        const primaryName = workbookFont.family.replace(/['"]/g, '').split(',')[0].trim()
        options.push({ value: workbookFont.family, label: `${primaryName} (Workbook Default)`, primary: primaryName, isDefault: true })
        options.push({ value: '__separator__', label: '───────────', disabled: true })
      }
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

  const handleSave = () => onSave(localConfig)
  const handleReset = () => setLocalConfig({ ...config })

  const handleApplyPalette = (paletteId) => {
    const palette = Config.colorPalettes[paletteId]
    if (palette && palette.colors.length >= 3) {
      setLocalConfig(prev => ({
        ...prev,
        colorPalette: paletteId,
        bar1Color: palette.colors[0],
        bar2Color: palette.colors[1],
        lineColor: palette.colors[2],
        pointFill: palette.colors[2],
        bar1BorderColor: Config.darkenColor(palette.colors[0], 20),
        bar2BorderColor: Config.darkenColor(palette.colors[1], 20)
      }))
    }
  }

  const updateFont = (fontKey, prop, value) => {
    setLocalConfig(prev => ({
      ...prev,
      [fontKey]: { ...(prev[fontKey] || {}), [prop]: value }
    }))
  }

  // Reusable number stepper component — uses inline styles to avoid CSS specificity conflicts
  const NumberStepper = ({ value, onChange, min, max, step = 1, suffix = '' }) => {
    const handleInput = (e) => {
      const raw = e.target.value
      if (raw === '' || raw === '-') return
      let num = parseFloat(raw)
      if (!isNaN(num)) {
        num = Math.min(max, Math.max(min, num))
        onChange(step < 1 ? parseFloat(num.toFixed(2)) : Math.round(num))
      }
    }
    const containerStyle = {
      display: 'inline-flex', alignItems: 'stretch', border: '1px solid var(--color-border, #e2e5ea)',
      borderRadius: '6px', overflow: 'hidden', height: '30px', flexShrink: 0,
      width: '148px', alignSelf: 'flex-start'
    }
    const btnStyle = {
      flex: '0 0 28px', width: '28px', height: '100%', border: 'none', borderRadius: 0,
      background: 'var(--color-surface, #f8f9fb)', color: 'var(--color-text-secondary, #6b7280)',
      fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 0, margin: 0, lineHeight: 1
    }
    const inputStyle = {
      flex: '1 1 auto', minWidth: 0, height: '100%', border: 'none',
      borderLeft: '1px solid var(--color-border, #e2e5ea)',
      borderRight: suffix ? 'none' : '1px solid var(--color-border, #e2e5ea)',
      borderRadius: 0, textAlign: 'center', fontSize: '12px', fontWeight: 600,
      fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text, #1a1d23)',
      background: 'var(--color-bg, #fff)', padding: 0, margin: 0, boxShadow: 'none',
      MozAppearance: 'textfield', WebkitAppearance: 'none'
    }
    const suffixStyle = {
      flex: '0 0 24px', width: '24px', textAlign: 'center',
      fontSize: '11px', color: 'var(--color-text-muted, #9ca3af)', padding: 0,
      margin: 0, background: 'var(--color-bg, #fff)', lineHeight: '30px',
      borderRight: '1px solid var(--color-border, #e2e5ea)', whiteSpace: 'nowrap',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }
    return (
      <div style={containerStyle}>
        <button type="button" style={{ ...btnStyle, opacity: value <= min ? 0.35 : 1 }}
          onClick={() => onChange(Math.max(min, parseFloat(((value || 0) - step).toFixed(2))))} disabled={value <= min}>&minus;</button>
        <input type="number" style={inputStyle} value={value} min={min} max={max} step={step}
          onChange={handleInput} onBlur={handleInput} />
        {suffix && <span style={suffixStyle}>{suffix}</span>}
        <button type="button" style={{ ...btnStyle, opacity: value >= max ? 0.35 : 1 }}
          onClick={() => onChange(Math.min(max, parseFloat(((value || 0) + step).toFixed(2))))} disabled={value >= max}>+</button>
      </div>
    )
  }

  // Field name badge component - shows custom label if set, otherwise field name
  const FieldBadge = ({ type, customLabel }) => {
    const fieldNames = getFieldNames(localConfig)
    const displayName = customLabel || getDisplayName(type, fieldNames, localConfig)

    // Don't show if no field is mapped
    const fieldName = type === 'bar1' ? localConfig.bar1Measure
      : type === 'bar2' ? localConfig.bar2Measure
      : type === 'line' ? localConfig.lineMeasure
      : null

    if (!fieldName && !customLabel) return null

    return (
      <span style={{
        marginLeft: 6,
        padding: '2px 8px',
        borderRadius: 4,
        background: 'var(--color-primary-light, #eef1fd)',
        color: 'var(--color-primary, #4361ee)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em'
      }}>
        {displayName}
      </span>
    )
  }

  // Reusable font controls component — compact 2-row layout
  const FontControls = ({ fontKey, label, sizeMin = 8, sizeMax = 24 }) => {
    const font = localConfig[fontKey] || {}
    return (
      <div className="font-controls-group">
        <label className="form-label">{label} Font</label>
        <div className="form-group indent">
          <select value={font.family || ''} onChange={(e) => updateFont(fontKey, 'family', e.target.value)}
            style={{ fontFamily: font.family || localConfig.fontFamily }}>
            <option value="">Use Global Font</option>
            {fontOptions.map((f, i) => (
              f.value === '__separator__'
                ? <option key={`sep-${i}`} disabled>───────────</option>
                : <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="font-props-row indent">
          <NumberStepper value={font.size || 12} min={sizeMin} max={sizeMax} suffix="px"
            onChange={(v) => updateFont(fontKey, 'size', v)} />
          <select value={String(font.weight || 400)} onChange={(e) => updateFont(fontKey, 'weight', parseInt(e.target.value))}
            className="font-weight-select">
            <option value="300">Light</option>
            <option value="400">Normal</option>
            <option value="500">Medium</option>
            <option value="600">Semi-Bold</option>
            <option value="700">Bold</option>
          </select>
          <input type="color" value={font.color || '#666666'} className="font-color-picker"
            onChange={(e) => updateFont(fontKey, 'color', e.target.value)} />
          <button type="button"
            className={`italic-toggle ${font.italic ? 'active' : ''}`}
            onClick={() => updateFont(fontKey, 'italic', !font.italic)}
            title="Italic">
            I
          </button>
        </div>
      </div>
    )
  }

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config)

  const tabs = [
    { id: 'data', label: 'Data' },
    { id: 'general', label: 'General' },
    { id: 'bars', label: 'Bars' },
    { id: 'line', label: 'Line' },
    { id: 'axes', label: 'Axes' },
    { id: 'title', label: 'Title & Grid' },
    { id: 'labels', label: 'Labels' },
    { id: 'legend', label: 'Legend' },
    { id: 'tooltip', label: 'Tooltip' },
    ...(showDebugTab ? [{ id: 'debug', label: 'Debug' }] : [])
  ]

  const dimensions = columns.filter(col =>
    col.dataType === 'string' || col.dataType === 'date' || col.dataType === 'date-time'
  )
  const measures = columns.filter(col =>
    col.dataType === 'float' || col.dataType === 'int'
  )
  const getAvailableMeasures = (currentField) => {
    const selected = [localConfig.bar1Measure, localConfig.bar2Measure, localConfig.lineMeasure].filter(f => f && f !== currentField)
    return measures.filter(m => !selected.includes(m.fieldName))
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

            {/* ═══ DATA MAPPING ═══ */}
            {activeTab === 'data' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Data Mapping</h3>
                  <p>Map worksheet fields to chart elements</p>
                </div>

                <div className="field-grid">
                  <div className="field-card">
                    <div className="field-card-label">Category (X-Axis)</div>
                    <select value={localConfig.dimension}
                      onChange={(e) => updateConfig('dimension', e.target.value)}>
                      <option value="">None</option>
                      {dimensions.map(dim => (
                        <option key={dim.fieldName} value={dim.fieldName}>{dim.fieldName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-card">
                    <div className="field-card-label">Bar 1 Measure</div>
                    <select value={localConfig.bar1Measure}
                      onChange={(e) => updateConfig('bar1Measure', e.target.value)}>
                      <option value="">None</option>
                      {getAvailableMeasures(localConfig.bar1Measure).map(m => (
                        <option key={m.fieldName} value={m.fieldName}>{m.fieldName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-card">
                    <div className="field-card-label">Bar 2 Measure</div>
                    <select value={localConfig.bar2Measure}
                      onChange={(e) => updateConfig('bar2Measure', e.target.value)}>
                      <option value="">None</option>
                      {getAvailableMeasures(localConfig.bar2Measure).map(m => (
                        <option key={m.fieldName} value={m.fieldName}>{m.fieldName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-card">
                    <div className="field-card-label">Line Measure</div>
                    <select value={localConfig.lineMeasure}
                      onChange={(e) => updateConfig('lineMeasure', e.target.value)}>
                      <option value="">None</option>
                      {getAvailableMeasures(localConfig.lineMeasure).map(m => (
                        <option key={m.fieldName} value={m.fieldName}>{m.fieldName}</option>
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
                    <button className="btn-text"
                      onClick={() => { setLocalConfig(prev => ({ ...prev, useManualMapping: false })); console.log('[Settings] Reset to encoding-based mode') }}>
                      Reset
                    </button>
                  </div>
                )}

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

            {/* ═══ GENERAL ═══ */}
            {activeTab === 'general' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>General</h3>
                  <p>Theme, font, animation and dashboard options</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Theme</label>
                  <select value={localConfig.theme}
                    onChange={(e) => updateConfig('theme', e.target.value)}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Global Font</label>
                  <select value={localConfig.fontFamily}
                    onChange={(e) => updateConfig('fontFamily', e.target.value)}
                    style={{ fontFamily: localConfig.fontFamily }}>
                    {fontOptions.map((f, i) => (
                      f.value === '__separator__'
                        ? <option key={`sep-${i}`} disabled>───────────</option>
                        : <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                  </select>
                  <p className="help-text">Default font for all chart elements. Override per element in their respective tabs.</p>
                </div>

                <div className="divider" />
                <div className="section-label">Color Palette</div>

                <div className="form-group">
                  <select value={localConfig.colorPalette}
                    onChange={(e) => handleApplyPalette(e.target.value)}>
                    {Object.entries(Config.colorPalettes).map(([id, palette]) => (
                      <option key={id} value={id}>{palette.name}</option>
                    ))}
                  </select>
                  <p className="help-text">Applies colors to bars, line and points. Fine-tune in their respective tabs.</p>
                </div>

                <div className="palette-preview">
                  {Config.colorPalettes[localConfig.colorPalette].colors.map((color, i) => (
                    <div key={i} className="palette-swatch" style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>

                <div className="divider" />
                <div className="section-label">Custom Labels</div>
                <p className="help-text">Override legend labels for each measure. Leave blank to use measure name.</p>
                <div className="form-group">
                  <label className="form-label">
                    Bar 1
                    {localConfig.bar1Measure && (
                      <span style={{ marginLeft: 6, color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 400 }}>
                        ({cleanFieldName(localConfig.bar1Measure)})
                      </span>
                    )}
                  </label>
                  <input type="text" value={localConfig.legendBar1Label} placeholder="Use measure name"
                    onChange={(e) => updateConfig('legendBar1Label', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Bar 2
                    {localConfig.bar2Measure && (
                      <span style={{ marginLeft: 6, color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 400 }}>
                        ({cleanFieldName(localConfig.bar2Measure)})
                      </span>
                    )}
                  </label>
                  <input type="text" value={localConfig.legendBar2Label} placeholder="Use measure name"
                    onChange={(e) => updateConfig('legendBar2Label', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Line
                    {localConfig.lineMeasure && (
                      <span style={{ marginLeft: 6, color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 400 }}>
                        ({cleanFieldName(localConfig.lineMeasure)})
                      </span>
                    )}
                  </label>
                  <input type="text" value={localConfig.legendLineLabel} placeholder="Use measure name"
                    onChange={(e) => updateConfig('legendLineLabel', e.target.value)} />
                </div>

                <div className="divider" />
                <div className="section-label">Animation</div>

                <label className="check-row">
                  <input type="checkbox" checked={localConfig.animationEnabled}
                    onChange={(e) => updateConfig('animationEnabled', e.target.checked)} />
                  <span>Enable Animations</span>
                </label>

                {localConfig.animationEnabled && (
                  <div className="form-row indent">
                    <div className="form-group">
                      <label className="form-label">Duration</label>
                      <NumberStepper value={localConfig.animationDuration} min={100} max={2000} step={100} suffix="ms"
                        onChange={(v) => updateConfig('animationDuration', v)} />
                    </div>
                    <div className="form-group">
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
                  </div>
                )}

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
              </div>
            )}

            {/* ═══ BARS ═══ */}
            {activeTab === 'bars' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Bars</h3>
                  <p>Bar style, spacing, borders and corners</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Bar Style</label>
                  <select value={localConfig.barStyle}
                    onChange={(e) => updateConfig('barStyle', e.target.value)}>
                    <option value="grouped">Grouped</option>
                    <option value="stacked">Stacked</option>
                  </select>
                </div>

                <div className="divider" />
                <div className="section-label">Spacing</div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Padding</label>
                    <NumberStepper value={localConfig.barPadding} min={0} max={0.5} step={0.05}
                      onChange={(v) => updateConfig('barPadding', v)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Width</label>
                    <NumberStepper value={localConfig.barWidth} min={20} max={100} step={5} suffix="%"
                      onChange={(v) => updateConfig('barWidth', v)} />
                  </div>
                </div>

                {localConfig.barStyle === 'grouped' && (
                  <div className="form-group">
                    <label className="form-label">Bar Gap</label>
                    <NumberStepper value={localConfig.barGap} min={0} max={20} suffix="px"
                      onChange={(v) => updateConfig('barGap', v)} />
                  </div>
                )}

                <div className="divider" />
                <div className="section-label">
                  Bar 1
                  <FieldBadge type="bar1" />
                </div>
                <div className="inline-row indent">
                  <div className="color-item compact">
                    <label>Fill</label>
                    <input type="color" value={localConfig.bar1Color}
                      onChange={(e) => updateConfig('bar1Color', e.target.value)} />
                  </div>
                  <div className="form-group compact">
                    <label className="form-label">Opacity</label>
                    <NumberStepper value={Math.round(localConfig.bar1Opacity * 100)} min={0} max={100} step={10} suffix="%"
                      onChange={(v) => updateConfig('bar1Opacity', v / 100)} />
                  </div>
                </div>
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
                      <NumberStepper value={localConfig.bar1BorderWidth} min={1} max={5} suffix="px"
                        onChange={(v) => updateConfig('bar1BorderWidth', v)} />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Corner Radius</label>
                  <NumberStepper value={localConfig.bar1CornerRadius} min={0} max={10} suffix="px"
                    onChange={(v) => updateConfig('bar1CornerRadius', v)} />
                </div>

                <div className="divider" />
                <div className="section-label">
                  Bar 2
                  <FieldBadge type="bar2" />
                </div>
                <div className="inline-row indent">
                  <div className="color-item compact">
                    <label>Fill</label>
                    <input type="color" value={localConfig.bar2Color}
                      onChange={(e) => updateConfig('bar2Color', e.target.value)} />
                  </div>
                  <div className="form-group compact">
                    <label className="form-label">Opacity</label>
                    <NumberStepper value={Math.round(localConfig.bar2Opacity * 100)} min={0} max={100} step={10} suffix="%"
                      onChange={(v) => updateConfig('bar2Opacity', v / 100)} />
                  </div>
                </div>
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
                      <NumberStepper value={localConfig.bar2BorderWidth} min={1} max={5} suffix="px"
                        onChange={(v) => updateConfig('bar2BorderWidth', v)} />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Corner Radius</label>
                  <NumberStepper value={localConfig.bar2CornerRadius} min={0} max={10} suffix="px"
                    onChange={(v) => updateConfig('bar2CornerRadius', v)} />
                </div>
              </div>
            )}

            {/* ═══ LINE ═══ */}
            {activeTab === 'line' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Line & Points</h3>
                  <p>Line style and data point markers</p>
                </div>

                <div className="section-label">
                  Line
                  <FieldBadge type="line" />
                </div>

                <div className="inline-row indent">
                  <div className="color-item compact">
                    <label>Color</label>
                    <input type="color" value={localConfig.lineColor}
                      onChange={(e) => updateConfig('lineColor', e.target.value)} />
                  </div>
                  <div className="form-group compact">
                    <label className="form-label">Opacity</label>
                    <NumberStepper value={Math.round(localConfig.lineOpacity * 100)} min={0} max={100} step={10} suffix="%"
                      onChange={(v) => updateConfig('lineOpacity', v / 100)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Width</label>
                  <NumberStepper value={localConfig.lineWidth} min={1} max={10} suffix="px"
                    onChange={(v) => updateConfig('lineWidth', v)} />
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
                        <NumberStepper value={localConfig.pointSize} min={2} max={15} suffix="px"
                          onChange={(v) => updateConfig('pointSize', v)} />
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
                        <NumberStepper value={localConfig.pointStrokeWidth} min={0} max={5} suffix="px"
                          onChange={(v) => updateConfig('pointStrokeWidth', v)} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ AXES ═══ */}
            {activeTab === 'axes' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Axes</h3>
                  <p>Axis mode, visibility, labels and range</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Axis Mode</label>
                  <select value={localConfig.axisMode}
                    onChange={(e) => updateConfig('axisMode', e.target.value)}>
                    <option value="dual">Dual Axis</option>
                    <option value="shared">Shared Axis</option>
                  </select>
                  <p className="help-text">
                    {localConfig.axisMode === 'dual'
                      ? 'Bars use the left Y-axis, line uses an independent right Y-axis.'
                      : 'All measures share a single left Y-axis.'}
                  </p>
                </div>

                {localConfig.axisMode === 'dual' && (
                  <label className="check-row">
                    <input type="checkbox" checked={localConfig.syncDualAxis}
                      onChange={(e) => updateConfig('syncDualAxis', e.target.checked)} />
                    <span>Sync Dual Axis Scales</span>
                  </label>
                )}

                <div className="divider" />
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
                    <div className="form-group indent">
                      <label className="form-label">Title</label>
                      <input type="text" value={localConfig.xAxisTitle} placeholder="Auto (use field name)"
                        onChange={(e) => updateConfig('xAxisTitle', e.target.value)} />
                    </div>
                    {localConfig.xAxisShowTitle && (
                      <FontControls fontKey="xAxisFont" label="X Axis Title" />
                    )}
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.xAxisShowLabels}
                        onChange={(e) => updateConfig('xAxisShowLabels', e.target.checked)} />
                      <span>Show Labels</span>
                    </label>
                    <FormatControls prefix="xAxis" localConfig={localConfig}
                      updateConfig={updateConfig} NumberStepper={NumberStepper} showDateFormats />
                    <p className="help-text indent" style={{ marginTop: -4, marginBottom: 8 }}>
                      Format applies to X-axis labels
                    </p>
                    {localConfig.xAxisShowLabels && (
                      <>
                        <FontControls fontKey="xAxisLabelFont" label="X Axis Labels" />
                        <div className="form-group indent">
                          <label className="form-label">Label Rotation</label>
                      <NumberStepper value={localConfig.xAxisRotation} min={-90} max={90} step={5} suffix="°"
                        onChange={(v) => updateConfig('xAxisRotation', v)} />
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
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Offset X</label>
                        <NumberStepper value={localConfig.xAxisLabelOffsetX} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('xAxisLabelOffsetX', v)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Offset Y</label>
                        <NumberStepper value={localConfig.xAxisLabelOffsetY} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('xAxisLabelOffsetY', v)} />
                      </div>
                    </div>
                      </>
                    )}
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.xAxisShowTickMarks}
                        onChange={(e) => updateConfig('xAxisShowTickMarks', e.target.checked)} />
                      <span>Show Tick Marks</span>
                    </label>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.xAxisShowAxisLine}
                        onChange={(e) => updateConfig('xAxisShowAxisLine', e.target.checked)} />
                      <span>Show Axis Line</span>
                    </label>
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
                  </>
                )}

                <div className="divider" />
                <div className="section-label">
                  Y Axis Left (Bars)
                  {(localConfig.bar1Measure || localConfig.bar2Measure) && (() => {
                    const fieldNames = getFieldNames(localConfig)
                    const labels = []
                    if (localConfig.bar1Measure) labels.push(getDisplayName('bar1', fieldNames, localConfig))
                    if (localConfig.bar2Measure) labels.push(getDisplayName('bar2', fieldNames, localConfig))
                    return <FieldBadge customLabel={labels.join(' / ')} />
                  })()}
                </div>
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
                      <>
                        <div className="form-group indent">
                          <input type="text" value={localConfig.yAxisLeftTitle} placeholder="Auto"
                            onChange={(e) => updateConfig('yAxisLeftTitle', e.target.value)} />
                        </div>
                        <FontControls fontKey="yAxisLeftFont" label="Y Left Axis" />
                      </>
                    )}
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisLeftShowLabels}
                        onChange={(e) => updateConfig('yAxisLeftShowLabels', e.target.checked)} />
                      <span>Show Labels</span>
                    </label>
                    <FormatControls prefix="yAxisLeft" localConfig={localConfig}
                      updateConfig={updateConfig} NumberStepper={NumberStepper} />
                    <p className="help-text indent" style={{ marginTop: -4, marginBottom: 8 }}>
                      Format applies to Y-axis (left) labels
                    </p>
                    {localConfig.yAxisLeftShowLabels && (
                      <>
                        <FontControls fontKey="yAxisLeftLabelFont" label="Y Left Labels" />
                        <div className="form-row indent">
                          <div className="form-group">
                            <label className="form-label">Label Offset X</label>
                            <NumberStepper value={localConfig.yAxisLeftLabelOffsetX} min={-20} max={20} suffix="px"
                              onChange={(v) => updateConfig('yAxisLeftLabelOffsetX', v)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Label Offset Y</label>
                            <NumberStepper value={localConfig.yAxisLeftLabelOffsetY} min={-20} max={20} suffix="px"
                              onChange={(v) => updateConfig('yAxisLeftLabelOffsetY', v)} />
                          </div>
                        </div>
                      </>
                    )}
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisLeftShowTickMarks}
                        onChange={(e) => updateConfig('yAxisLeftShowTickMarks', e.target.checked)} />
                      <span>Show Tick Marks</span>
                    </label>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisLeftShowAxisLine}
                        onChange={(e) => updateConfig('yAxisLeftShowAxisLine', e.target.checked)} />
                      <span>Show Axis Line</span>
                    </label>
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
                  </>
                )}

                <div className="divider" />
                <div className="section-label">
                  Y Axis Right (Line)
                  <FieldBadge type="line" />
                </div>
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
                      <>
                        <div className="form-group indent">
                          <input type="text" value={localConfig.yAxisRightTitle} placeholder="Auto"
                            onChange={(e) => updateConfig('yAxisRightTitle', e.target.value)} />
                        </div>
                        <FontControls fontKey="yAxisRightFont" label="Y Right Axis" />
                      </>
                    )}
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisRightShowLabels}
                        onChange={(e) => updateConfig('yAxisRightShowLabels', e.target.checked)} />
                      <span>Show Labels</span>
                    </label>
                    <FormatControls prefix="yAxisRight" localConfig={localConfig}
                      updateConfig={updateConfig} NumberStepper={NumberStepper} />
                    <p className="help-text indent" style={{ marginTop: -4, marginBottom: 8 }}>
                      Format applies to Y-axis (right) labels
                    </p>
                    {localConfig.yAxisRightShowLabels && (
                      <>
                        <FontControls fontKey="yAxisRightLabelFont" label="Y Right Labels" />
                        <div className="form-row indent">
                          <div className="form-group">
                            <label className="form-label">Label Offset X</label>
                            <NumberStepper value={localConfig.yAxisRightLabelOffsetX} min={-20} max={20} suffix="px"
                              onChange={(v) => updateConfig('yAxisRightLabelOffsetX', v)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Label Offset Y</label>
                            <NumberStepper value={localConfig.yAxisRightLabelOffsetY} min={-20} max={20} suffix="px"
                              onChange={(v) => updateConfig('yAxisRightLabelOffsetY', v)} />
                          </div>
                        </div>
                      </>
                    )}
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisRightShowTickMarks}
                        onChange={(e) => updateConfig('yAxisRightShowTickMarks', e.target.checked)} />
                      <span>Show Tick Marks</span>
                    </label>
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.yAxisRightShowAxisLine}
                        onChange={(e) => updateConfig('yAxisRightShowAxisLine', e.target.checked)} />
                      <span>Show Axis Line</span>
                    </label>
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
                  </>
                )}
              </div>
            )}

            {/* ═══ TITLE & GRID ═══ */}
            {activeTab === 'title' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Title & Grid</h3>
                  <p>Chart title, grid lines and visual separators</p>
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
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Padding</label>
                        <NumberStepper value={localConfig.titlePadding} min={0} max={40} suffix="px"
                          onChange={(v) => updateConfig('titlePadding', v)} />
                      </div>
                      <div className="color-item compact">
                        <label>Background</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="color" value={localConfig.titleBgColor === 'transparent' ? '#ffffff' : localConfig.titleBgColor}
                            disabled={localConfig.titleBgColor === 'transparent'}
                            onChange={(e) => updateConfig('titleBgColor', e.target.value)} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={localConfig.titleBgColor === 'transparent'}
                              onChange={(e) => updateConfig('titleBgColor', e.target.checked ? 'transparent' : '#ffffff')} />
                            None
                          </label>
                        </div>
                      </div>
                    </div>
                    <FontControls fontKey="titleFont" label="Title" sizeMin={10} sizeMax={36} />
                  </>
                )}

                <div className="divider" />
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
                      <NumberStepper value={Math.round(localConfig.gridOpacity * 100)} min={0} max={100} step={10} suffix="%"
                        onChange={(v) => updateConfig('gridOpacity', v / 100)} />
                    </div>
                  </div>
                )}

                <div className="divider" />
                <div className="section-label">Separators</div>
                <p className="help-text">Border lines between chart sections.</p>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showHeaderBorder}
                    onChange={(e) => updateConfig('showHeaderBorder', e.target.checked)} />
                  <span>Show Header Border</span>
                </label>
                {localConfig.showHeaderBorder && (
                  <div className="inline-row indent">
                    <div className="form-group compact">
                      <label className="form-label">Style</label>
                      <select value={localConfig.headerBorderStyle || 'solid'}
                        onChange={(e) => updateConfig('headerBorderStyle', e.target.value)}>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </div>
                    <div className="form-group compact">
                      <label className="form-label">Width</label>
                      <NumberStepper value={localConfig.headerBorderWidth || 1} min={1} max={5} suffix="px"
                        onChange={(v) => updateConfig('headerBorderWidth', v)} />
                    </div>
                    <div className="color-item compact">
                      <label>Color</label>
                      <input type="color" value={localConfig.headerBorderColor || '#e2e5ea'}
                        onChange={(e) => updateConfig('headerBorderColor', e.target.value)} />
                    </div>
                  </div>
                )}
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.showLegendBorder}
                    onChange={(e) => updateConfig('showLegendBorder', e.target.checked)} />
                  <span>Show Legend Border</span>
                </label>
                {localConfig.showLegendBorder && (
                  <div className="inline-row indent">
                    <div className="form-group compact">
                      <label className="form-label">Style</label>
                      <select value={localConfig.legendBorderStyle || 'solid'}
                        onChange={(e) => updateConfig('legendBorderStyle', e.target.value)}>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </div>
                    <div className="form-group compact">
                      <label className="form-label">Width</label>
                      <NumberStepper value={localConfig.legendBorderWidth || 1} min={1} max={5} suffix="px"
                        onChange={(v) => updateConfig('legendBorderWidth', v)} />
                    </div>
                    <div className="color-item compact">
                      <label>Color</label>
                      <input type="color" value={localConfig.legendBorderColor || '#e2e5ea'}
                        onChange={(e) => updateConfig('legendBorderColor', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ LABELS ═══ */}
            {activeTab === 'labels' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Labels</h3>
                  <p>Independent data labels for each series</p>
                </div>

                <div className="section-label">
                  Bar 1 Labels
                  <FieldBadge type="bar1" />
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.bar1LabelsShow}
                    onChange={(e) => updateConfig('bar1LabelsShow', e.target.checked)} />
                  <span>Show Bar 1 Labels</span>
                </label>
                <FormatControls prefix="bar1Labels" localConfig={localConfig}
                  updateConfig={updateConfig} NumberStepper={NumberStepper} />
                <p className="help-text indent" style={{ marginTop: -4, marginBottom: 8 }}>
                  Format applies to Bar 1 labels and tooltips
                </p>
                {localConfig.bar1LabelsShow && (
                  <>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Position</label>
                        <select value={localConfig.bar1LabelsPosition}
                          onChange={(e) => updateConfig('bar1LabelsPosition', e.target.value)}>
                          <option value="top">Top</option>
                          <option value="inside">Inside</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                    </div>
                    <FontControls fontKey="bar1LabelFont" label="Bar 1 Label" />
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Offset X</label>
                        <NumberStepper value={localConfig.bar1LabelsOffsetX} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('bar1LabelsOffsetX', v)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Offset Y</label>
                        <NumberStepper value={localConfig.bar1LabelsOffsetY} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('bar1LabelsOffsetY', v)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="divider" />
                <div className="section-label">
                  Bar 2 Labels
                  <FieldBadge type="bar2" />
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.bar2LabelsShow}
                    onChange={(e) => updateConfig('bar2LabelsShow', e.target.checked)} />
                  <span>Show Bar 2 Labels</span>
                </label>
                <FormatControls prefix="bar2Labels" localConfig={localConfig}
                  updateConfig={updateConfig} NumberStepper={NumberStepper} />
                <p className="help-text indent" style={{ marginTop: -4, marginBottom: 8 }}>
                  Format applies to Bar 2 labels and tooltips
                </p>
                {localConfig.bar2LabelsShow && (
                  <>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Position</label>
                        <select value={localConfig.bar2LabelsPosition}
                          onChange={(e) => updateConfig('bar2LabelsPosition', e.target.value)}>
                          <option value="top">Top</option>
                          <option value="inside">Inside</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                    </div>
                    <FontControls fontKey="bar2LabelFont" label="Bar 2 Label" />
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Offset X</label>
                        <NumberStepper value={localConfig.bar2LabelsOffsetX} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('bar2LabelsOffsetX', v)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Offset Y</label>
                        <NumberStepper value={localConfig.bar2LabelsOffsetY} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('bar2LabelsOffsetY', v)} />
                      </div>
                    </div>
                  </>
                )}

                <div className="divider" />
                <div className="section-label">
                  Line Labels
                  <FieldBadge type="line" />
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={localConfig.lineLabelsShow}
                    onChange={(e) => updateConfig('lineLabelsShow', e.target.checked)} />
                  <span>Show Line Labels</span>
                </label>
                <FormatControls prefix="lineLabels" localConfig={localConfig}
                  updateConfig={updateConfig} NumberStepper={NumberStepper} />
                <p className="help-text indent" style={{ marginTop: -4, marginBottom: 8 }}>
                  Format applies to Line labels and tooltips
                </p>
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
                    </div>
                    <FontControls fontKey="lineLabelFont" label="Line Label" />
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Offset X</label>
                        <NumberStepper value={localConfig.lineLabelsOffsetX} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('lineLabelsOffsetX', v)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Offset Y</label>
                        <NumberStepper value={localConfig.lineLabelsOffsetY} min={-20} max={20} suffix="px"
                          onChange={(v) => updateConfig('lineLabelsOffsetY', v)} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ LEGEND ═══ */}
            {activeTab === 'legend' && (
              <div className="settings-tab">
                <div className="tab-header">
                  <h3>Legend</h3>
                  <p>Legend position, spacing and custom labels</p>
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
                      {['top', 'bottom'].includes(localConfig.legendPosition) && (
                        <div className="form-group">
                          <label className="form-label">Layout</label>
                          <select value={localConfig.legendLayout || 'wrap'}
                            onChange={(e) => updateConfig('legendLayout', e.target.value)}>
                            <option value="wrap">Multiple Rows</option>
                            <option value="nowrap">Single Row</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Alignment — context-aware based on position */}
                    {['top', 'bottom'].includes(localConfig.legendPosition) ? (
                      <div className="form-row indent">
                        <div className="form-group">
                          <label className="form-label">Alignment</label>
                          <select value={localConfig.legendAlign || 'center'}
                            onChange={(e) => updateConfig('legendAlign', e.target.value)}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="form-row indent">
                        <div className="form-group">
                          <label className="form-label">Horizontal Align</label>
                          <select value={localConfig.legendAlign || 'center'}
                            onChange={(e) => updateConfig('legendAlign', e.target.value)}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Vertical Align</label>
                          <select value={localConfig.legendVerticalAlign || 'top'}
                            onChange={(e) => updateConfig('legendVerticalAlign', e.target.value)}>
                            <option value="top">Top</option>
                            <option value="center">Center</option>
                            <option value="bottom">Bottom</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="divider" />
                    <div className="section-label">Spacing & Style</div>
                    <div className="form-row indent">
                      <div className="form-group">
                        <label className="form-label">Padding</label>
                        <NumberStepper value={localConfig.legendPadding} min={0} max={40} suffix="px"
                          onChange={(v) => updateConfig('legendPadding', v)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Item Gap</label>
                        <NumberStepper value={localConfig.legendGap} min={4} max={60} suffix="px"
                          onChange={(v) => updateConfig('legendGap', v)} />
                      </div>
                    </div>
                    <div className="color-item compact indent">
                      <label>Background</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" value={localConfig.legendBgColor === 'transparent' ? '#ffffff' : localConfig.legendBgColor}
                          disabled={localConfig.legendBgColor === 'transparent'}
                          onChange={(e) => updateConfig('legendBgColor', e.target.value)} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={localConfig.legendBgColor === 'transparent'}
                            onChange={(e) => updateConfig('legendBgColor', e.target.checked ? 'transparent' : '#ffffff')} />
                          None
                        </label>
                      </div>
                    </div>

                    <div className="divider" />
                    <FontControls fontKey="legendFont" label="Legend" />
                  </>
                )}
              </div>
            )}

            {/* ═══ TOOLTIP ═══ */}
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
                    <label className="check-row indent">
                      <input type="checkbox" checked={localConfig.tooltipUseCustom}
                        onChange={(e) => updateConfig('tooltipUseCustom', e.target.checked)} />
                      <span>Use Custom Template</span>
                    </label>

                    {!localConfig.tooltipUseCustom ? (
                      <div className="check-group indent">
                        <label className="check-row">
                          <input type="checkbox" checked={localConfig.tooltipShowDimension}
                            onChange={(e) => updateConfig('tooltipShowDimension', e.target.checked)} />
                          <span>Show Dimension</span>
                        </label>
                        <label className="check-row">
                          <input type="checkbox" checked={localConfig.tooltipShowMeasureName}
                            onChange={(e) => updateConfig('tooltipShowMeasureName', e.target.checked)} />
                          <span>Show Measure Name</span>
                        </label>
                        <label className="check-row">
                          <input type="checkbox" checked={localConfig.tooltipShowValue}
                            onChange={(e) => updateConfig('tooltipShowValue', e.target.checked)} />
                          <span>Show Value</span>
                        </label>
                      </div>
                    ) : (
                      <div className="indent" style={{ marginTop: 12 }}>
                        <div style={{ marginBottom: 8 }}>
                          <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Format Text:</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const selected = text.substring(start, end)
                                if (selected) {
                                  const wrapped = `<b>${selected}</b>`
                                  textarea.value = text.substring(0, start) + wrapped + text.substring(end)
                                  textarea.selectionStart = start
                                  textarea.selectionEnd = start + wrapped.length
                                  textarea.focus()
                                  updateConfig('tooltipTemplate', textarea.value)
                                }
                              }}
                              title="Bold">
                              <strong>B</strong>
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const selected = text.substring(start, end)
                                if (selected) {
                                  const wrapped = `<i>${selected}</i>`
                                  textarea.value = text.substring(0, start) + wrapped + text.substring(end)
                                  textarea.selectionStart = start
                                  textarea.selectionEnd = start + wrapped.length
                                  textarea.focus()
                                  updateConfig('tooltipTemplate', textarea.value)
                                }
                              }}
                              title="Italic">
                              <em>I</em>
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const selected = text.substring(start, end)
                                if (selected) {
                                  const wrapped = `<u>${selected}</u>`
                                  textarea.value = text.substring(0, start) + wrapped + text.substring(end)
                                  textarea.selectionStart = start
                                  textarea.selectionEnd = start + wrapped.length
                                  textarea.focus()
                                  updateConfig('tooltipTemplate', textarea.value)
                                }
                              }}
                              title="Underline">
                              <u>U</u>
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const selected = text.substring(start, end)
                                if (selected) {
                                  const wrapped = `<strong>${selected}</strong>`
                                  textarea.value = text.substring(0, start) + wrapped + text.substring(end)
                                  textarea.selectionStart = start
                                  textarea.selectionEnd = start + wrapped.length
                                  textarea.focus()
                                  updateConfig('tooltipTemplate', textarea.value)
                                }
                              }}
                              title="Strong (Bold)">
                              Strong
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const selected = text.substring(start, end)
                                if (selected) {
                                  const wrapped = `<small>${selected}</small>`
                                  textarea.value = text.substring(0, start) + wrapped + text.substring(end)
                                  textarea.selectionStart = start
                                  textarea.selectionEnd = start + wrapped.length
                                  textarea.focus()
                                  updateConfig('tooltipTemplate', textarea.value)
                                }
                              }}
                              title="Small text">
                              Small
                            </button>
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Insert Field:</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const insertion = `{dimension_label} : {dimension}`
                                textarea.value = text.substring(0, start) + insertion + text.substring(end)
                                textarea.selectionStart = textarea.selectionEnd = start + insertion.length
                                textarea.focus()
                                updateConfig('tooltipTemplate', textarea.value)
                              }}>
                              Dimension
                              {(() => {
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('dimension', fieldNames, localConfig)
                                return displayName !== 'Category' ? ` (${displayName})` : ''
                              })()}
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('bar1', fieldNames, localConfig)
                                const insertion = `${displayName} : {bar1_value}`
                                textarea.value = text.substring(0, start) + insertion + text.substring(end)
                                textarea.selectionStart = textarea.selectionEnd = start + insertion.length
                                textarea.focus()
                                updateConfig('tooltipTemplate', textarea.value)
                              }}>
                              Bar 1
                              {(() => {
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('bar1', fieldNames, localConfig)
                                return displayName !== 'Unknown' ? ` (${displayName})` : ''
                              })()}
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('bar2', fieldNames, localConfig)
                                const insertion = `${displayName} : {bar2_value}`
                                textarea.value = text.substring(0, start) + insertion + text.substring(end)
                                textarea.selectionStart = textarea.selectionEnd = start + insertion.length
                                textarea.focus()
                                updateConfig('tooltipTemplate', textarea.value)
                              }}>
                              Bar 2
                              {(() => {
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('bar2', fieldNames, localConfig)
                                return displayName !== 'Unknown' ? ` (${displayName})` : ''
                              })()}
                            </button>
                            <button type="button" className="btn-secondary btn-sm"
                              onClick={() => {
                                const textarea = document.getElementById('tooltip-template')
                                const start = textarea.selectionStart
                                const end = textarea.selectionEnd
                                const text = textarea.value
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('line', fieldNames, localConfig)
                                const insertion = `${displayName} : {line_value}`
                                textarea.value = text.substring(0, start) + insertion + text.substring(end)
                                textarea.selectionStart = textarea.selectionEnd = start + insertion.length
                                textarea.focus()
                                updateConfig('tooltipTemplate', textarea.value)
                              }}>
                              Line
                              {(() => {
                                const fieldNames = getFieldNames(localConfig)
                                const displayName = getDisplayName('line', fieldNames, localConfig)
                                return displayName !== 'Unknown' ? ` (${displayName})` : ''
                              })()}
                            </button>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Template</label>
                          <textarea id="tooltip-template"
                            value={localConfig.tooltipTemplate}
                            onChange={(e) => updateConfig('tooltipTemplate', e.target.value)}
                            placeholder="e.g., {dimension_label} : {dimension}&#10;{bar1_label} : {bar1_value}&#10;{bar2_label} : {bar2_value}&#10;{line_label} : {line_value}"
                            rows={5}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                          <p className="help-text" style={{ marginTop: 6 }}>
                            <strong>Tokens:</strong> <code>{'{dimension}'}</code>, <code>{'{dimension_label}'}</code>, <code>{'{bar1}'}</code>, <code>{'{bar2}'}</code>, <code>{'{line}'}</code>,
                            <code>{'{bar1_label}'}</code>, <code>{'{bar1_value}'}</code>, <code>{'{measure}'}</code>, <code>{'{value}'}</code><br/>
                            <strong>HTML:</strong> Select text and use formatting buttons above, or use tags like <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;u&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;em&gt;</code>, <code>&lt;small&gt;</code>, <code>&lt;br/&gt;</code>
                          </p>
                        </div>
                        {localConfig.tooltipTemplate && (
                          <div style={{ marginTop: 12, padding: 12, background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>PREVIEW:</div>
                            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                              {localConfig.tooltipTemplate.split('\n').map((line, i) => {
                                const fieldNames = getFieldNames(localConfig)
                                const preview = line
                                  .replace(/\{dimension_label\}/g, getDisplayName('dimension', fieldNames, localConfig) || 'Category')
                                  .replace(/\{dimension\}/g, 'Jan\' 25')
                                  .replace(/\{bar1_label\}/g, getDisplayName('bar1', fieldNames, localConfig) || 'Bar 1')
                                  .replace(/\{bar1_value\}/g, '1,234')
                                  .replace(/\{bar1\}/g, `${getDisplayName('bar1', fieldNames, localConfig) || 'Bar 1'}: 1,234`)
                                  .replace(/\{bar2_label\}/g, getDisplayName('bar2', fieldNames, localConfig) || 'Bar 2')
                                  .replace(/\{bar2_value\}/g, '5,678')
                                  .replace(/\{bar2\}/g, `${getDisplayName('bar2', fieldNames, localConfig) || 'Bar 2'}: 5,678`)
                                  .replace(/\{line_label\}/g, getDisplayName('line', fieldNames, localConfig) || 'Line')
                                  .replace(/\{line_value\}/g, '42.5%')
                                  .replace(/\{line\}/g, `${getDisplayName('line', fieldNames, localConfig) || 'Line'}: 42.5%`)
                                  .replace(/\{measure\}/g, 'Bar 1')
                                  .replace(/\{value\}/g, '1,234')
                                return preview.trim() ? (
                                  <div key={i} className="tooltip-row" dangerouslySetInnerHTML={{ __html: preview }} />
                                ) : null
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="divider" />
                    <div className="section-label">Style</div>
                    <div className="color-item compact indent">
                      <label>Background</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" value={localConfig.tooltipBgColor === 'transparent' ? '#ffffff' : localConfig.tooltipBgColor}
                          disabled={localConfig.tooltipBgColor === 'transparent'}
                          onChange={(e) => updateConfig('tooltipBgColor', e.target.value)} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={localConfig.tooltipBgColor === 'transparent'}
                            onChange={(e) => updateConfig('tooltipBgColor', e.target.checked ? 'transparent' : '#333333')} />
                          None
                        </label>
                      </div>
                    </div>
                    <FontControls fontKey="tooltipFont" label="Tooltip" />
                  </>
                )}
              </div>
            )}

            {/* ═══ DEBUG (hidden until Ctrl+Shift+D) ═══ */}
            {activeTab === 'debug' && showDebugTab && (
              <div className="settings-tab debug-tab">
                <div className="tab-header">
                  <h3>Debug Console</h3>
                  <p>Press Ctrl+Shift+D to toggle</p>
                </div>

                <div className="debug-tab-actions">
                  <button className="btn-secondary btn-sm"
                    onClick={() => { setShowDebugTab(false); setActiveTab('data') }}>
                    Hide
                  </button>
                  <button className="btn-secondary btn-sm"
                    onClick={() => onClearDebugLogs && onClearDebugLogs()}>
                    Clear
                  </button>
                  <button className="btn-secondary btn-sm"
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
                      } catch { console.warn('Copy failed') }
                    }}>
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
