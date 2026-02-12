/**
 * Display Name Utilities
 * Single source of truth for field/measure display names throughout the extension
 */

/**
 * Clean field name by removing aggregation functions
 * SUM(Sales) → Sales
 * AVG(Revenue) → Revenue
 */
export const cleanFieldName = (name) => {
  if (!name) return '';
  return name.replace(/^(SUM|AVG|MIN|MAX|COUNT|AGG|MEDIAN|STDEV|VAR|ATTR)\((.+)\)$/i, '$2').trim();
}

/**
 * Get display name for a measure (bar1, bar2, or line)
 * Priority: custom label > axis title (for dimension) > cleaned field name > 'Unknown'
 */
export const getDisplayName = (type, fieldNames, config) => {
  const fieldName = type === 'bar1' ? fieldNames?.bar1
    : type === 'bar2' ? fieldNames?.bar2
    : type === 'line' ? fieldNames?.line
    : fieldNames?.dimension;

  const customLabel = type === 'bar1' ? config?.legendBar1Label
    : type === 'bar2' ? config?.legendBar2Label
    : type === 'line' ? config?.legendLineLabel
    : config?.legendDimensionLabel;

  // Custom label takes priority
  if (customLabel) return customLabel;

  // For dimension, also check X-axis title as fallback
  if (type === 'dimension' && config?.xAxisTitle) return config.xAxisTitle;

  // Otherwise use cleaned field name
  if (!fieldName) return type === 'dimension' ? 'Category' : 'Unknown';

  return cleanFieldName(fieldName);
}

/**
 * Get field names object from current data mapping
 */
export const getFieldNames = (config) => {
  return {
    dimension: config?.dimension || '',
    bar1: config?.bar1Measure || '',
    bar2: config?.bar2Measure || '',
    line: config?.lineMeasure || ''
  };
}
