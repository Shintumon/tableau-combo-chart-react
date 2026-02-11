import { useState, useEffect } from 'react'

function useTableauExtension() {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [columns, setColumns] = useState([])
  const [worksheet, setWorksheet] = useState(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const ws = tableau.extensions.worksheetContent.worksheet
      setWorksheet(ws)

      const dataTable = await ws.getSummaryDataAsync()

      // Extract columns with field info
      const cols = dataTable.columns.map(col => ({
        fieldName: col.fieldName,
        dataType: col.dataType,
        index: col.index
      }))

      // Process data for combo chart
      // Assuming structure: dimension, bar1, bar2, line
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

  useEffect(() => {
    // Initialize Tableau Extensions API
    tableau.extensions.initializeAsync().then(() => {
      console.log('Tableau extension initialized')
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
    worksheet,
    refreshData: loadData
  }
}

export default useTableauExtension
