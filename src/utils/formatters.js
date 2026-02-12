/**
 * Label & Axis Formatting Utilities
 * Supports: number, currency, scientific, percentage, custom, date, and legacy compact formats
 */
import * as d3 from 'd3'

/**
 * Extract format options from config for a given prefix
 * @param {Object} config - Full config object
 * @param {string} prefix - Config key prefix (e.g. 'bar1Labels', 'lineLabels', 'yAxisLeft')
 * @returns {Object} Format options object
 */
export const getFormatOpts = (config, prefix) => ({
  format: config[prefix + 'Format'] || 'auto',
  decimals: config[prefix + 'Decimals'] ?? 0,
  currencySymbol: config[prefix + 'CurrencySymbol'] || '$',
  currencyPosition: config[prefix + 'CurrencyPosition'] || 'prefix',
  negativeStyle: config[prefix + 'NegativeStyle'] || 'minus',
  displayUnits: config[prefix + 'DisplayUnits'] || 'none',
  prefix: config[prefix + 'Prefix'] || '',
  suffix: config[prefix + 'Suffix'] || '',
  thousandsSep: config[prefix + 'ThousandsSep'] !== false,
  customFormat: config[prefix + 'CustomFormat'] || '',
  dateFormat: config[prefix + 'DateFormat'] || 'shortDate',
  customDateFormat: config[prefix + 'CustomDateFormat'] || ''
})

/**
 * Convert Tableau/Excel-style date format tokens to d3.timeFormat specifiers.
 * If the string already contains '%', treat it as d3 native format.
 * Tokens are matched greedily (longest first).
 */
const toD3DateFormat = (fmt) => {
  if (!fmt || fmt.includes('%')) return fmt
  // Token map: Tableau/Excel → d3.timeFormat (ordered longest-first)
  const tokens = [
    ['MMMM', '%B'],    // Full month: January
    ['MMM', '%b'],     // Abbrev month: Jan
    ['MM', '%m'],      // Zero-padded month: 01
    ['M', '%-m'],      // Month: 1
    ['dddd', '%A'],    // Full weekday: Monday
    ['ddd', '%a'],     // Abbrev weekday: Mon
    ['dd', '%d'],      // Zero-padded day: 01
    ['d', '%-d'],      // Day: 1
    ['YYYY', '%Y'],    // 4-digit year
    ['yyyy', '%Y'],
    ['YY', '%y'],      // 2-digit year
    ['yy', '%y'],
    ['HH', '%H'],      // 24-hour
    ['hh', '%I'],      // 12-hour
    ['mm', '%M'],      // Minutes
    ['ss', '%S'],      // Seconds
    ['tt', '%p'],      // AM/PM
    ['a', '%p'],       // am/pm
  ]
  let result = ''
  let i = 0
  while (i < fmt.length) {
    let matched = false
    for (const [token, d3Token] of tokens) {
      if (fmt.substring(i, i + token.length) === token) {
        result += d3Token
        i += token.length
        matched = true
        break
      }
    }
    if (!matched) {
      // Quarter: Q → computed separately, pass through as literal
      result += fmt[i]
      i++
    }
  }
  return result
}

/**
 * Build a date formatter from preset key or custom format string
 */
const buildDateFormatter = (dateFormat, customDateFormat) => {
  return (value) => {
    const date = value instanceof Date ? value : new Date(value)
    if (isNaN(date.getTime())) return String(value)

    switch (dateFormat) {
      case 'longDate':
        return new Intl.DateTimeFormat('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }).format(date)
      case 'shortDate':
        return d3.timeFormat('%-m/%-d/%Y')(date)
      case 'ddMMyyyy':
        return d3.timeFormat('%d/%m/%Y')(date)
      case 'isoDate':
        return d3.timeFormat('%Y-%m-%d')(date)
      case 'monthYear':
        return d3.timeFormat('%B %Y')(date)
      case 'abbrevDate':
        return d3.timeFormat('%b %-d, %Y')(date)
      case 'yearQuarter': {
        const q = Math.ceil((date.getMonth() + 1) / 3)
        return `${date.getFullYear()} Q${q}`
      }
      case 'yearWeek': {
        const jan1 = new Date(date.getFullYear(), 0, 1)
        const days = Math.floor((date - jan1) / 86400000)
        const week = Math.ceil((days + jan1.getDay() + 1) / 7)
        return `${date.getFullYear()} W${String(week).padStart(2, '0')}`
      }
      case 'custom':
        try {
          return d3.timeFormat(toD3DateFormat(customDateFormat) || '%Y-%m-%d')(date)
        } catch {
          return String(value)
        }
      default:
        return d3.timeFormat('%-m/%-d/%Y')(date)
    }
  }
}

/**
 * Build a legacy compact formatter (auto K/M/B based on magnitude)
 */
const buildCompactFormatter = (decimals, prefix, suffix, negativeStyle) => {
  return (v) => {
    const abs = Math.abs(v)
    let scaled, unitSuffix
    if (abs >= 1e9) { scaled = v / 1e9; unitSuffix = 'B' }
    else if (abs >= 1e6) { scaled = v / 1e6; unitSuffix = 'M' }
    else if (abs >= 1e3) { scaled = v / 1e3; unitSuffix = 'K' }
    else { scaled = v; unitSuffix = '' }

    const formatted = unitSuffix
      ? d3.format(`.${decimals}f`)(Math.abs(scaled))
      : d3.format(`,.${decimals}f`)(Math.abs(scaled))

    const isNeg = v < 0
    if (isNeg && negativeStyle === 'parens') {
      return `(${prefix}${formatted}${unitSuffix}${suffix})`
    }
    return `${isNeg ? '-' : ''}${prefix}${formatted}${unitSuffix}${suffix}`
  }
}

/**
 * Display units configuration
 */
const UNIT_CONFIG = {
  none: { divisor: 1, unitSuffix: '' },
  thousands: { divisor: 1e3, unitSuffix: 'K' },
  millions: { divisor: 1e6, unitSuffix: 'M' },
  billions: { divisor: 1e9, unitSuffix: 'B' }
}

/**
 * Main formatter factory
 * @param {Object} opts - Format options from getFormatOpts()
 * @returns {Function|null} Formatter function or null for 'auto'
 */
export const getFormatter = (opts) => {
  const {
    format, decimals = 0, currencySymbol = '$',
    currencyPosition = 'prefix', negativeStyle = 'minus',
    displayUnits = 'none', prefix = '', suffix = '',
    thousandsSep = true, customFormat = '',
    dateFormat = 'shortDate', customDateFormat = ''
  } = opts

  if (!format || format === 'auto') return null

  // Date formatting
  if (format === 'date') {
    return buildDateFormatter(dateFormat, customDateFormat)
  }

  // Legacy compact support
  if (format === 'compact') {
    return buildCompactFormatter(decimals, prefix, suffix, negativeStyle)
  }

  // Custom d3 format string
  if (format === 'custom' && customFormat) {
    try {
      const d3Fmt = d3.format(customFormat)
      return (v) => {
        const formatted = d3Fmt(Math.abs(v))
        const isNeg = v < 0
        if (isNeg && negativeStyle === 'parens') {
          return `(${prefix}${formatted}${suffix})`
        }
        return `${isNeg ? '-' : ''}${prefix}${formatted}${suffix}`
      }
    } catch {
      return (v) => `${prefix}${String(v)}${suffix}`
    }
  }

  // Build core d3 format specifier
  const sep = thousandsSep ? ',' : ''
  let coreFormat

  switch (format) {
    case 'number':
      coreFormat = d3.format(`${sep}.${decimals}f`)
      break
    case 'currency':
      coreFormat = d3.format(`${sep}.${decimals}f`)
      break
    case 'scientific':
      coreFormat = d3.format(`.${decimals}e`)
      break
    case 'percent':
      coreFormat = d3.format(`.${decimals}%`)
      break
    default:
      return null
  }

  // Auto display units: dynamically pick K/M/B based on magnitude
  const isAutoUnits = displayUnits === 'auto'
  const fixedUnit = UNIT_CONFIG[displayUnits] || UNIT_CONFIG.none

  const getUnit = (v) => {
    if (!isAutoUnits) return fixedUnit
    const abs = Math.abs(v)
    if (abs >= 1e9) return UNIT_CONFIG.billions
    if (abs >= 1e6) return UNIT_CONFIG.millions
    if (abs >= 1e3) return UNIT_CONFIG.thousands
    return UNIT_CONFIG.none
  }

  return (v) => {
    const unit = getUnit(v)
    const scaled = format === 'percent' ? v : v / unit.divisor
    const formatted = coreFormat(Math.abs(scaled))
    const unitSuf = format === 'percent' ? '' : unit.unitSuffix
    const isNeg = v < 0

    // Currency symbol placement: before or after the number
    const currBefore = format === 'currency' && currencyPosition === 'prefix' ? currencySymbol : ''
    const currAfter = format === 'currency' && currencyPosition === 'suffix' ? currencySymbol : ''

    if (isNeg && negativeStyle === 'parens') {
      return `(${prefix}${currBefore}${formatted}${unitSuf}${currAfter}${suffix})`
    }
    return `${isNeg ? '-' : ''}${prefix}${currBefore}${formatted}${unitSuf}${currAfter}${suffix}`
  }
}
