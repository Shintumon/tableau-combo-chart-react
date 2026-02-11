# Combo Chart Extension (React + D3.js)

A customizable combo chart extension for Tableau featuring dual bars and line chart with full marks card controls.

## Features

- 📊 **D3.js Visualization** - Powerful chart rendering
- 🎨 **Customizable Colors** - Configure bar and line colors
- ⚙️ **Rich Settings** - Comprehensive configuration dialog
- 🐛 **Debug Console** - Built-in debugging tools (Ctrl+Shift+D)
- 💾 **Persistent Settings** - Saves configuration in Tableau workbook
- 🎬 **Animations** - Optional animated transitions
- 🔄 **Real-time Updates** - Automatic refresh on data changes

## Development

```bash
npm run dev     # Development server on localhost:8766
npm run build   # Production build
npm run preview # Preview production build
```

## Testing in Tableau

1. Start dev server: `npm run dev`
2. In Tableau, insert Extension object
3. Browse to `public/ComboChart.trex`
4. Drag dimensions and measures to marks card:
   - **Category** (dimension)
   - **Bar 1** (measure)
   - **Bar 2** (measure)
   - **Line** (measure)

## React + D3 Integration

This extension uses the recommended pattern for integrating D3.js with React:
- React manages component lifecycle
- D3 handles DOM manipulation within refs
- `useEffect` triggers D3 rendering on data/config changes

See `src/components/ComboChart.jsx` for implementation.

## Configuration Options

- **Appearance**: Height, theme, legend, grid, animations
- **Colors**: Custom colors for bars and line
- **Advanced**: Line width, point size, bar padding

## Tech Stack

- React 18
- D3.js v7
- Vite
- Tableau Extensions API

## Reusable Components

- `DebugConsole` - Shared with advanced-table-react
- Settings dialog pattern
- Tableau integration hook

Built with ❤️ for creating better Tableau visualizations.
