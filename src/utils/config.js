export const Config = {
  current: {
    // Chart dimensions
    width: 'auto',
    height: 400,
    margins: { top: 20, right: 60, bottom: 40, left: 60 },

    // Colors
    bar1Color: '#4e79a7',
    bar2Color: '#f28e2c',
    lineColor: '#e15759',

    // Chart settings
    showLegend: true,
    showGrid: true,
    animationEnabled: true,

    // Bar settings
    barOpacity: 0.8,
    barPadding: 0.1,

    // Line settings
    lineWidth: 2,
    showPoints: true,
    pointRadius: 4,

    // Axes
    xAxisLabel: '',
    yAxisLabel: '',
    yAxisLabelRight: '',

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

  getTheme(themeName) {
    return this.themes[themeName] || this.themes.light
  }
}
