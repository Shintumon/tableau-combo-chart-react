/**
 * Configuration Management for Combo Chart Extension (React)
 */

// Cache for system fonts (populated once)
let systemFontsCache = null

// Fallback fonts when Local Font Access API is unavailable
const fallbackFontFamilies = [
  { value: '"Tableau Book", "Tableau Regular", Arial, sans-serif', label: 'Tableau Book', primary: 'Tableau Book' },
  { value: '"Tableau Light", "Tableau Regular", Arial, sans-serif', label: 'Tableau Light', primary: 'Tableau Light' },
  { value: '"Tableau Medium", "Tableau Regular", Arial, sans-serif', label: 'Tableau Medium', primary: 'Tableau Medium' },
  { value: '"Tableau Semibold", "Tableau Regular", Arial, sans-serif', label: 'Tableau Semibold', primary: 'Tableau Semibold' },
  { value: '"Segoe UI", Tahoma, Geneva, sans-serif', label: 'Segoe UI', primary: 'Segoe UI' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', primary: 'Arial' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica Neue', primary: 'Helvetica Neue' },
  { value: 'Roboto, "Helvetica Neue", sans-serif', label: 'Roboto', primary: 'Roboto' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans', primary: 'Open Sans' },
  { value: '"Source Sans Pro", sans-serif', label: 'Source Sans Pro', primary: 'Source Sans Pro' },
  { value: 'Lato, sans-serif', label: 'Lato', primary: 'Lato' },
  { value: '"Inter", sans-serif', label: 'Inter', primary: 'Inter' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia', primary: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', primary: 'Times New Roman' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana', primary: 'Verdana' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New', primary: 'Courier New' }
]

/**
 * Build a font stack with appropriate fallbacks based on font type
 */
function buildFontStack(primaryFont) {
  const lowerFont = primaryFont.toLowerCase()
  if (lowerFont.includes('tableau')) {
    return `'${primaryFont}', 'Tableau Regular', Arial, sans-serif`
  }
  if (['georgia', 'times new roman', 'times', 'palatino', 'garamond'].some(f => lowerFont.includes(f))) {
    return `'${primaryFont}', Georgia, 'Times New Roman', serif`
  }
  if (['courier', 'consolas', 'monaco', 'menlo', 'monospace'].some(f => lowerFont.includes(f))) {
    return `'${primaryFont}', Consolas, Monaco, monospace`
  }
  return `'${primaryFont}', 'Segoe UI', Arial, sans-serif`
}

export const Config = {
  // Color palettes (Tableau-style)
  colorPalettes: {
    'tableau10': {
      name: 'Tableau 10',
      colors: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab']
    },
    'tableau20': {
      name: 'Tableau 20',
      colors: ['#4e79a7', '#a0cbe8', '#f28e2c', '#ffbe7d', '#59a14f', '#8cd17d', '#b6992d', '#f1ce63', '#499894', '#86bcb6', '#e15759', '#ff9d9a', '#79706e', '#bab0ac', '#d37295', '#fabfd2', '#b07aa1', '#d4a6c8', '#9d7660', '#d7b5a6']
    },
    'colorBlind': {
      name: 'Color Blind Safe',
      colors: ['#1170aa', '#fc7d0b', '#a3acb9', '#57606c', '#5fa2ce', '#c85200', '#7b848f', '#a3cce9', '#ffbc79', '#c8d0d9']
    },
    'seattle': {
      name: 'Seattle Grays',
      colors: ['#767f8b', '#b3b7b8', '#5c6068', '#9ea4ac', '#d7d8d9', '#3b3f45', '#8a8f96', '#c6c9cc', '#454a51', '#babdbf']
    },
    'trafficLight': {
      name: 'Traffic Light',
      colors: ['#b10318', '#dba13a', '#309343', '#d82526', '#ffc156', '#69b764', '#f26c64', '#ffdd71', '#a5d99f']
    },
    'purpleGray': {
      name: 'Purple-Gray',
      colors: ['#7b66d2', '#a699e8', '#dc5fbd', '#ffc0da', '#5f5a41', '#b4b19b', '#995688', '#d898ba', '#ab6ad5', '#d098ee']
    },
    'greenOrange': {
      name: 'Green-Orange',
      colors: ['#32a251', '#acd98d', '#ff7f0f', '#ffb977', '#3cb7cc', '#98d9e4', '#b85a0d', '#ffd94a', '#39737c', '#86b4a9']
    },
    'blueRed': {
      name: 'Blue-Red',
      colors: ['#2c69b0', '#b5c8e2', '#f02720', '#ffb6b0', '#ac613c', '#e9c39b', '#6ba3d6', '#b5dffd', '#ac8763', '#ddc9b4']
    },
    'cyclic': {
      name: 'Cyclic',
      colors: ['#1f83b4', '#12a2a8', '#2ca030', '#78a641', '#bcbd22', '#ffbf50', '#ffaa0e', '#ff7f0e', '#d63a3a', '#c7519c', '#ba43b4', '#8a60b0', '#6f63bb']
    },
    'classic': {
      name: 'Classic',
      colors: ['#7ab800', '#6ac7de', '#ff6f01', '#fbb034', '#68adef', '#6d6e70', '#a4dbcc', '#ffbf9a', '#b3d9ff', '#d0d0d0']
    }
  },

  // Font families available (static fallback list, replaced at runtime by init())
  fontFamilies: [...fallbackFontFamilies],

  // Detected workbook font info (set by init())
  workbookFont: null,
  workbookFormatting: null,

  // Default configuration
  current: {
    // Data mapping
    dimension: '',
    bar1Measure: '',
    bar2Measure: '',
    lineMeasure: '',
    useManualMapping: false, // If true, use saved field names; if false, always use position-based mapping

    // Chart dimensions
    width: 'auto',
    height: 400,
    margins: { top: 20, right: 60, bottom: 40, left: 60 },

    // Color palette
    colorPalette: 'tableau10',

    // Bar settings
    barStyle: 'grouped', // 'grouped' or 'stacked'
    barPadding: 0.2,
    barGap: 4,       // px gap between bar 1 and bar 2 in grouped mode
    barWidth: 100,   // Percentage of available space (0-100%)

    bar1Color: '#4e79a7',
    bar1Opacity: 1,
    bar1ShowBorder: true,
    bar1BorderColor: '#3a5f80',
    bar1BorderWidth: 1,
    bar1CornerRadius: 2,

    bar2Color: '#f28e2c',
    bar2Opacity: 1,
    bar2ShowBorder: true,
    bar2BorderColor: '#c47223',
    bar2BorderWidth: 1,
    bar2CornerRadius: 2,

    // Line settings
    lineColor: '#e15759',
    lineOpacity: 1,
    lineWidth: 2,
    lineStyle: 'solid', // 'solid', 'dashed', 'dotted'
    lineCurve: 'linear', // 'linear', 'monotone', 'cardinal', 'step'
    lineVerticalPosition: 'auto', // 'auto', 'top', 'middle', 'bottom'

    // Point settings
    showPoints: true,
    pointSize: 5,
    pointShape: 'circle', // 'circle', 'square', 'diamond', 'triangle'
    pointFill: '#e15759',
    pointStroke: '#ffffff',
    pointStrokeWidth: 1,

    // Animation settings
    animationEnabled: true,
    animationDuration: 500, // milliseconds
    animationEasing: 'easeCubicOut', // easeLinear, easeCubicOut, easeElastic, easeBounce

    // Axis settings
    axisMode: 'dual', // 'dual' or 'shared'
    syncDualAxis: false, // When true, both Y-axes share the same scale

    // X Axis
    xAxisShow: true,
    xAxisTitle: '',
    xAxisShowTitle: true,
    xAxisShowLabels: true,
    xAxisShowTickMarks: true,
    xAxisShowAxisLine: true,
    xAxisFontSize: 12,
    xAxisRotation: 0,
    xAxisAlign: 'center',
    xAxisSort: 'default',
    xAxisMaxWidth: 'none',
    xAxisFormat: 'auto',
    xAxisDecimals: 0,
    xAxisCurrencySymbol: '$',
    xAxisTickColor: '#999999',
    xAxisLineColor: '#999999',
    xAxisLabelOffsetX: 0,
    xAxisLabelOffsetY: 10,

    // Y Axis Left
    yAxisLeftShow: true,
    yAxisLeftTitle: '',
    yAxisLeftShowTitle: true,
    yAxisLeftShowLabels: true,
    yAxisLeftShowTickMarks: true,
    yAxisLeftShowAxisLine: true,
    yAxisLeftMin: null,
    yAxisLeftMax: null,
    yAxisLeftFormat: 'auto',
    yAxisLeftDecimals: 0,
    yAxisLeftCurrencySymbol: '$',
    yAxisLeftIncludeZero: true,
    yAxisLeftTickColor: '#999999',
    yAxisLeftLineColor: '#999999',
    yAxisLeftLabelOffsetX: 0,
    yAxisLeftLabelOffsetY: 0,

    // Y Axis Right
    yAxisRightShow: true,
    yAxisRightTitle: '',
    yAxisRightShowTitle: true,
    yAxisRightShowLabels: true,
    yAxisRightShowTickMarks: true,
    yAxisRightShowAxisLine: true,
    yAxisRightMin: null,
    yAxisRightMax: null,
    yAxisRightFormat: 'auto',
    yAxisRightDecimals: 0,
    yAxisRightCurrencySymbol: '$',
    yAxisRightIncludeZero: true,
    yAxisRightTickColor: '#999999',
    yAxisRightLineColor: '#999999',
    yAxisRightLabelOffsetX: 0,
    yAxisRightLabelOffsetY: 0,

    // Grid
    gridHorizontal: true,
    gridVertical: false,
    gridColor: '#e0e0e0',
    gridOpacity: 0.5,

    // Title
    titleShow: true,
    titleText: 'Combo Chart',
    titleFontSize: 18,
    titleColor: '#333333',
    titleBgColor: 'transparent',
    titlePadding: 10,

    // Bar Labels
    barLabelsShow: false,
    barLabelsPosition: 'top', // 'top', 'inside', 'center'
    barLabelsFontSize: 12,
    barLabelsColor: '#333333',
    barLabelsFormat: 'auto',
    barLabelsDecimals: 0,
    barLabelsCurrencySymbol: '$',
    barLabelsOffsetX: 0,
    barLabelsOffsetY: 0,

    // Line Labels
    lineLabelsShow: false,
    lineLabelsPosition: 'top', // 'top', 'bottom', 'left', 'right', 'center'
    lineLabelsFontSize: 12,
    lineLabelsColor: '#333333',
    lineLabelsFormat: 'auto',
    lineLabelsDecimals: 0,
    lineLabelsCurrencySymbol: '$',
    lineLabelsOffsetX: 0,
    lineLabelsOffsetY: 0,

    // Legend
    showLegend: true,
    legendPosition: 'bottom', // 'bottom', 'top', 'right', 'left'
    legendAlign: 'center', // 'left', 'center', 'right'
    legendDimensionLabel: '',  // Custom label for dimension (empty = use dimension name)
    legendBar1Label: '',  // Custom label for bar 1 (empty = use measure name)
    legendBar2Label: '',  // Custom label for bar 2
    legendLineLabel: '',  // Custom label for line
    legendBgColor: 'transparent',
    legendPadding: 14,
    legendGap: 24,

    // Tooltip
    tooltipShow: true,
    tooltipShowDimension: true,
    tooltipShowMeasureName: true,
    tooltipShowValue: true,
    tooltipUseCustom: false,
    tooltipTemplate: '',
    tooltipBgColor: '#333333',
    tooltipTextColor: '#ffffff',
    tooltipFontSize: 12,

    // Typography (global defaults - per-element fonts override these)
    fontFamily: '"Tableau Book", "Tableau Regular", Arial, sans-serif',
    titleWeight: '600',
    labelWeight: '400',

    // Per-element font settings (empty family = fall back to global fontFamily)
    xAxisFont: { family: '', size: 12, weight: 400, color: '#666666', italic: false },
    yAxisLeftFont: { family: '', size: 12, weight: 400, color: '#666666', italic: false },
    yAxisRightFont: { family: '', size: 12, weight: 400, color: '#666666', italic: false },
    legendFont: { family: '', size: 13, weight: 500, color: '#666666', italic: false },
    bar1LabelFont: { family: '', size: 12, weight: 400, color: '#333333', italic: false },
    bar2LabelFont: { family: '', size: 12, weight: 400, color: '#333333', italic: false },
    lineLabelFont: { family: '', size: 12, weight: 400, color: '#333333', italic: false },
    tooltipFont: { family: '', size: 12, weight: 400, color: '#ffffff', italic: false },
    titleFont: { family: '', size: 18, weight: 600, color: '#333333', italic: false },

    // Dashboard Controls
    showSettingsCog: true,
    showRefreshButton: true,

    // Chart Separators
    showHeaderBorder: true,
    showLegendBorder: false,

    // Theme
    theme: 'light'
  },

  themes: {
    light: {
      backgroundColor: '#ffffff',
      textColor: '#333333',
      gridColor: '#e0e0e0',
      axisColor: '#666666'
    },
    dark: {
      backgroundColor: '#1e1e1e',
      textColor: '#e0e0e0',
      gridColor: '#404040',
      axisColor: '#999999'
    }
  },

  /**
   * Apply a color palette to the current configuration
   */
  applyColorPalette(paletteId) {
    const palette = this.colorPalettes[paletteId]
    if (palette && palette.colors.length >= 3) {
      this.current.colorPalette = paletteId
      this.current.bar1Color = palette.colors[0]
      this.current.bar2Color = palette.colors[1]
      this.current.lineColor = palette.colors[2]
      this.current.pointFill = palette.colors[2]
      // Generate border colors (darker versions)
      this.current.bar1BorderColor = this.darkenColor(palette.colors[0], 20)
      this.current.bar2BorderColor = this.darkenColor(palette.colors[1], 20)
    }
  },

  /**
   * Darken a hex color by a percentage
   */
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.max(0, (num >> 16) - amt)
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt)
    const B = Math.max(0, (num & 0x0000FF) - amt)
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
  },

  /**
   * Parse font size string (e.g. "12pt", "16px") to a number in px
   */
  parseFontSize(sizeStr) {
    if (!sizeStr) return null
    const num = parseFloat(sizeStr)
    if (isNaN(num)) return null
    if (String(sizeStr).includes('pt')) return Math.round(num * 1.333)
    if (String(sizeStr).includes('em') || String(sizeStr).includes('rem')) return Math.round(num * 16)
    return Math.round(num)
  },

  /**
   * Read workbook formatting from Tableau environment
   */
  getWorkbookFormatting() {
    if (this.workbookFormatting) return this.workbookFormatting

    try {
      if (typeof tableau !== 'undefined' && tableau.extensions?.environment) {
        const env = tableau.extensions.environment
        if (env.workbookFormatting?.formattingSheets) {
          const sheets = env.workbookFormatting.formattingSheets
          const formatting = {}

          sheets.forEach(sheet => {
            const key = sheet.classNameKey
            const css = sheet.cssProperties || {}

            const fontInfo = {
              fontName: css.fontName || css.fontFamily || css['font-family'] || null,
              fontSize: css.fontSize || css['font-size'] || null,
              fontWeight: css.isFontBold ? 'bold' : (css['font-weight'] || 'normal'),
              fontStyle: css.isFontItalic ? 'italic' : 'normal',
              color: css.color || null
            }

            if (key === 'tableau-worksheet' || key === 'Worksheet') {
              formatting.worksheet = fontInfo
            } else if (key === 'tableau-worksheet-title' || key === 'WorksheetTitle') {
              formatting.worksheetTitle = fontInfo
            } else if (key === 'tableau-tooltip' || key === 'Tooltip') {
              formatting.tooltip = fontInfo
            }
          })

          this.workbookFormatting = formatting
          console.log('[Config] Workbook formatting detected:', JSON.stringify(formatting))
          return formatting
        }
      }
    } catch (e) {
      console.log('[Config] Could not get workbook formatting:', e.message)
    }

    return null
  },

  /**
   * Extract the workbook's default font family and sizes
   */
  getWorkbookFont() {
    const formatting = this.getWorkbookFormatting()

    let fontFamily = null
    const sources = [formatting?.worksheet, formatting?.worksheetTitle]

    for (const source of sources) {
      if (source?.fontName && !fontFamily) {
        let fontName = source.fontName.replace(/['"]/g, '').trim()
        fontFamily = buildFontStack(fontName)
      }
    }

    const worksheetFontSize = formatting?.worksheet?.fontSize
      ? this.parseFontSize(formatting.worksheet.fontSize) : null
    const worksheetTitleFontSize = formatting?.worksheetTitle?.fontSize
      ? this.parseFontSize(formatting.worksheetTitle.fontSize) : null

    if (!fontFamily && !worksheetFontSize && !worksheetTitleFontSize) {
      return null
    }

    return { family: fontFamily, worksheetFontSize, worksheetTitleFontSize }
  },

  /**
   * Initialize config with workbook formatting defaults.
   * Call after tableau.extensions.initializeAsync() completes.
   */
  init() {
    const workbookFont = this.getWorkbookFont()
    if (workbookFont) {
      console.log('[Config] Using workbook formatting as defaults:', JSON.stringify(workbookFont))
      this.workbookFont = workbookFont

      if (workbookFont.family) {
        this.current.fontFamily = workbookFont.family
      }
      if (workbookFont.worksheetTitleFontSize) {
        this.current.titleFontSize = workbookFont.worksheetTitleFontSize
      }
    } else {
      console.log('[Config] No workbook formatting detected - using defaults')
    }
  },

  /**
   * Get available system fonts (async). Uses Local Font Access API with fallback.
   * Returns array of { value, label, primary }
   */
  async getSystemFonts() {
    if (systemFontsCache) return systemFontsCache

    try {
      if (window.queryLocalFonts) {
        console.log('[Config] Trying Local Font Access API...')
        const fonts = await Promise.race([
          window.queryLocalFonts(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ])
        const fontArray = Array.isArray(fonts) ? fonts : (fonts ? Array.from(fonts) : [])
        if (fontArray.length > 0) {
          const familySet = new Set()
          const systemFonts = []

          fontArray.forEach(font => {
            const family = font.family
            if (!familySet.has(family)) {
              familySet.add(family)
              systemFonts.push({
                value: buildFontStack(family),
                label: family,
                primary: family
              })
            }
          })

          systemFonts.sort((a, b) => a.label.localeCompare(b.label))
          systemFontsCache = systemFonts
          console.log(`[Config] Local Font Access API: found ${systemFonts.length} font families`)
          return systemFonts
        }
      }
    } catch (e) {
      console.log('[Config] Local Font Access API unavailable/timeout:', e.message)
    }

    systemFontsCache = fallbackFontFamilies
    console.log(`[Config] Using fallback font list: ${fallbackFontFamilies.length} fonts`)
    return fallbackFontFamilies
  }
}
