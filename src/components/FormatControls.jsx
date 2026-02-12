/**
 * Reusable format controls for labels and axes.
 * Supports number, currency, scientific, percentage, custom, date formats.
 */

export default function FormatControls({ prefix, localConfig, updateConfig, NumberStepper, showDateFormats = false }) {
  const fmt = localConfig[prefix + 'Format'] || 'auto'
  const isNumeric = ['number', 'currency', 'scientific', 'percent'].includes(fmt)
  const showDisplayUnits = ['number', 'currency'].includes(fmt)
  const showThousandsSep = ['number', 'currency'].includes(fmt)
  const showCurrency = fmt === 'currency'
  const showCustom = fmt === 'custom'
  const showDate = fmt === 'date'
  const showDecimals = isNumeric
  const showNegative = isNumeric
  const showPrefixSuffix = isNumeric || showCustom

  const get = (key) => localConfig[prefix + key]
  const set = (key, val) => updateConfig(prefix + key, val)

  return (
    <div className="format-controls">
      {/* Format type */}
      <div className="form-row indent">
        <div className="form-group">
          <label className="form-label">Format</label>
          <select value={fmt} onChange={(e) => set('Format', e.target.value)}>
            <option value="auto">Automatic</option>
            <option value="number">Number</option>
            <option value="currency">Currency</option>
            <option value="scientific">Scientific</option>
            <option value="percent">Percentage</option>
            <option value="custom">Custom</option>
            {showDateFormats && <option value="date">Date</option>}
            {fmt === 'compact' && <option value="compact">Compact (K/M/B)</option>}
          </select>
        </div>
      </div>

      {/* Legacy compact hint */}
      {fmt === 'compact' && (
        <div className="form-row indent">
          <span className="help-text">Legacy format. Select Number with Display Units for more options.</span>
        </div>
      )}

      {/* Decimals + Negative style */}
      {showDecimals && (
        <div className="form-row indent">
          <div className="form-group">
            <label className="form-label">Decimals</label>
            <NumberStepper value={get('Decimals') ?? 0} min={0} max={10}
              onChange={(v) => set('Decimals', v)} />
          </div>
          {showNegative && (
            <div className="form-group">
              <label className="form-label">Negatives</label>
              <select value={get('NegativeStyle') || 'minus'}
                onChange={(e) => set('NegativeStyle', e.target.value)}>
                <option value="minus">-1234</option>
                <option value="parens">(1234)</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Display Units */}
      {showDisplayUnits && (
        <div className="form-row indent">
          <div className="form-group">
            <label className="form-label">Display Units</label>
            <select value={get('DisplayUnits') || 'none'}
              onChange={(e) => set('DisplayUnits', e.target.value)}>
              <option value="none">None</option>
              <option value="thousands">Thousands (K)</option>
              <option value="millions">Millions (M)</option>
              <option value="billions">Billions (B)</option>
            </select>
          </div>
        </div>
      )}

      {/* Thousands Separator */}
      {showThousandsSep && (
        <label className="check-row indent">
          <input type="checkbox" checked={get('ThousandsSep') !== false}
            onChange={(e) => set('ThousandsSep', e.target.checked)} />
          <span>Thousands Separator</span>
        </label>
      )}

      {/* Currency Symbol */}
      {showCurrency && (
        <div className="form-row indent">
          <div className="form-group">
            <label className="form-label">Currency Symbol</label>
            <input type="text" value={get('CurrencySymbol') || '$'} style={{ width: 60 }}
              onChange={(e) => set('CurrencySymbol', e.target.value)} />
          </div>
        </div>
      )}

      {/* Custom format string */}
      {showCustom && (
        <div className="form-row indent">
          <div className="form-group">
            <label className="form-label">Format String</label>
            <input type="text" value={get('CustomFormat') || ''} style={{ width: 120 }}
              placeholder="e.g. ,.2f"
              onChange={(e) => set('CustomFormat', e.target.value)} />
          </div>
        </div>
      )}

      {/* Prefix / Suffix */}
      {showPrefixSuffix && (
        <div className="form-row indent">
          <div className="form-group">
            <label className="form-label">Prefix</label>
            <input type="text" value={get('Prefix') || ''} style={{ width: 80 }}
              placeholder=""
              onChange={(e) => set('Prefix', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Suffix</label>
            <input type="text" value={get('Suffix') || ''} style={{ width: 80 }}
              placeholder=""
              onChange={(e) => set('Suffix', e.target.value)} />
          </div>
        </div>
      )}

      {/* Date format presets */}
      {showDate && (
        <>
          <div className="form-row indent">
            <div className="form-group">
              <label className="form-label">Date Format</label>
              <select value={get('DateFormat') || 'shortDate'}
                onChange={(e) => set('DateFormat', e.target.value)}>
                <option value="shortDate">3/14/2001</option>
                <option value="longDate">Wednesday, March 14, 2001</option>
                <option value="ddMMyyyy">14/03/2001</option>
                <option value="isoDate">2001-03-14</option>
                <option value="monthYear">March 2001</option>
                <option value="abbrevDate">Mar 14, 2001</option>
                <option value="yearQuarter">2001 Q1</option>
                <option value="yearWeek">2001 W11</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
          </div>
          {get('DateFormat') === 'custom' && (
            <div className="form-row indent">
              <div className="form-group">
                <label className="form-label">Custom Format</label>
                <input type="text" value={get('CustomDateFormat') || ''} style={{ width: 140 }}
                  placeholder="e.g. %Y-%m-%d"
                  onChange={(e) => set('CustomDateFormat', e.target.value)} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
