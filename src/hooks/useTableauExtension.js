import { useState, useEffect, useCallback, useRef } from 'react'
import { Config } from '../utils/config'
import { getLogs } from '../utils/logger'

function useTableauExtension() {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [columns, setColumns] = useState([])
  const [encodingMap, setEncodingMap] = useState({})
  const [worksheet, setWorksheet] = useState(null)

  // Ref to hold the configure callback (set by App via onConfigure)
  const configureCallbackRef = useRef(null)

  // Read encoding assignments from the marks card via getVisualSpecificationAsync
  const getEncodingMap = async (ws) => {
    try {
      const visualSpec = await ws.getVisualSpecificationAsync()
      const marksCard =
        visualSpec.marksSpecifications[visualSpec.activeMarksSpecificationIndex]

      const map = {}
      for (const encoding of marksCard.encodings) {
        if (encoding.field) {
          map[encoding.id] = encoding.field.name
          console.log(`[Encoding] ${encoding.id} → ${encoding.field.name}`)
        }
      }

      console.log('[Encoding] Full encoding map:', JSON.stringify(map))
      return map
    } catch (err) {
      console.error('[Encoding] Failed to get visual spec:', err)
      return {}
    }
  }

  // Match encoding base field name to actual data column name
  // Handles transformations: "Sales" → "SUM(Sales)", "Order Date" → "YEAR(Order Date)"
  const resolveFieldName = (baseFieldName, cols) => {
    // Direct match first
    if (cols.some(c => c.fieldName === baseFieldName)) {
      return baseFieldName
    }
    // Match column containing the base name inside parentheses: AGG(fieldName)
    const wrapped = cols.find(c => c.fieldName.includes(`(${baseFieldName})`))
    if (wrapped) return wrapped.fieldName
    // Match column ending with the base name (e.g. "Calculation.Sales" or similar)
    const endsWith = cols.find(c => c.fieldName.endsWith(baseFieldName))
    if (endsWith) return endsWith.fieldName
    // No match found, return as-is
    return baseFieldName
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const ws = tableau.extensions.worksheetContent.worksheet
      setWorksheet(ws)

      // Fetch encoding map and summary data in parallel
      const [encMap, dataTable] = await Promise.all([
        getEncodingMap(ws),
        ws.getSummaryDataAsync()
      ])

      // Extract columns with field info
      const cols = dataTable.columns.map(col => ({
        fieldName: col.fieldName,
        dataType: col.dataType,
        index: col.index
      }))

      // Resolve encoding base field names to actual data column names
      // encoding.field.name returns base name (e.g. "Sales") but data columns
      // include transformations (e.g. "SUM(Sales)", "YEAR(Order Date)")
      const resolvedEncMap = {}
      for (const [encId, baseFieldName] of Object.entries(encMap)) {
        const resolved = resolveFieldName(baseFieldName, cols)
        resolvedEncMap[encId] = resolved
        if (resolved !== baseFieldName) {
          console.log(`[Encoding] Resolved ${encId}: "${baseFieldName}" → "${resolved}"`)
        }
      }

      // Process data for combo chart
      const processedData = dataTable.data.map(row => {
        const rowData = {}
        row.forEach((cell, index) => {
          const fieldName = cols[index].fieldName
          rowData[fieldName] = {
            value: cell.value,
            formattedValue: cell.formattedValue
          }
        })
        return rowData
      })

      setEncodingMap(resolvedEncMap)
      setColumns(cols)
      setData(processedData)
      setError(null)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Open the settings dialog as a native Tableau popup window
  const openConfigDialog = useCallback(() => {
    console.log('[Extension] Opening config dialog...')

    // Build the dialog URL relative to the extension's location
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '')
    const dialogUrl = baseUrl + '/dialog.html'
    console.log('[Extension] Dialog URL:', dialogUrl)

    // Pass live config, columns, encodingMap and main extension logs
    // so dialog has everything it needs (avoids race condition with debounced settings save)
    const payload = JSON.stringify({
      config: Config.current,
      columns: columns,
      encodingMap: encodingMap,
      extensionLogs: getLogs(),
      workbookFont: Config.workbookFont
    })

    tableau.extensions.ui.displayDialogAsync(dialogUrl, payload, {
      width: 620,
      height: 580
    }).then(async (closePayload) => {
      console.log('[Extension] Dialog closed with payload:', closePayload)
      if (closePayload === 'saved') {
        // Reload data to apply new settings
        await loadData()
      }
    }).catch((dialogError) => {
      if (dialogError.errorCode === tableau.ErrorCodes.DialogClosedByUser) {
        console.log('[Extension] Dialog closed by user')
      } else {
        console.error('[Extension] Dialog error:', dialogError.message || dialogError)
      }
    })
  }, [columns, encodingMap])

  // Allow App to set the configure callback
  const setConfigureCallback = useCallback((callback) => {
    configureCallbackRef.current = callback
  }, [])

  useEffect(() => {
    // Initialize Tableau Extensions API with configure callback
    tableau.extensions.initializeAsync({
      configure: () => {
        // Delegate to whatever callback is currently set
        if (configureCallbackRef.current) {
          configureCallbackRef.current()
        }
      }
    }).then(() => {
      console.log('Tableau extension initialized')

      // Detect workbook formatting and apply as defaults
      Config.init()

      setInitialized(true)
      loadData()

      // Listen for data changes
      const ws = tableau.extensions.worksheetContent.worksheet
      ws.addEventListener(
        tableau.TableauEventType.SummaryDataChanged,
        loadData
      )

      // Cleanup
      return () => {
        ws.removeEventListener(
          tableau.TableauEventType.SummaryDataChanged,
          loadData
        )
      }
    }).catch(err => {
      console.error('Failed to initialize:', err)
      setError(err.message || 'Failed to initialize extension')
      setLoading(false)
    })
  }, [])

  return {
    initialized,
    loading,
    error,
    data,
    columns,
    encodingMap,
    worksheet,
    refreshData: loadData,
    openConfigDialog,
    setConfigureCallback
  }
}

export default useTableauExtension
