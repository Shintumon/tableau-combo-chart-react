import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { Config } from '../utils/config'
import { getFormatter, getFormatOpts } from '../utils/formatters'
import { getDisplayName, getFieldNames } from '../utils/displayNames'

function ComboChart({ data, columns, config }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove()

    // Get dimensions from container (fills available space)
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height || config.height

    // Calculate responsive margins based on axis visibility, labels, and titles
    const baseMargin = Math.min(width, height) * 0.08

    // Bottom margin: x-axis labels (rotation-aware) + title
    let marginBottom = 10
    if (config.xAxisShow !== false) {
      if (config.xAxisShowLabels !== false) {
        const xRotation = Math.abs(config.xAxisRotation || 0)
        marginBottom = xRotation === 0 ? 30 : xRotation <= 45 ? 50 : 70
      } else {
        marginBottom = 15
      }
      if (config.xAxisShowTitle !== false) marginBottom += 25
    }

    // Left margin: y-axis labels + title
    let marginLeft = 10
    if (config.yAxisLeftShow !== false) {
      if (config.yAxisLeftShowLabels !== false) {
        marginLeft = Math.max(60, Math.min(100, baseMargin * 1.4))
      } else {
        marginLeft = 15
      }
      if (config.yAxisLeftShowTitle !== false) marginLeft += 30
    }

    // Right margin: right y-axis + title (dual mode only)
    const isSharedAxisMode = config.axisMode === 'shared'
    let marginRight = 10
    if (!isSharedAxisMode && config.yAxisRightShow !== false) {
      if (config.yAxisRightShowLabels !== false) {
        marginRight = Math.max(50, Math.min(80, baseMargin * 1.1))
      } else {
        marginRight = 15
      }
      if (config.yAxisRightShowTitle !== false) marginRight += 25
    }

    const margin = {
      top: config.margins?.top || 20,
      right: marginRight,
      bottom: marginBottom,
      left: marginLeft
    }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Typography config
    const fontFamily = config.fontFamily || '"Tableau Book", Arial, sans-serif'
    const labelWeight = config.labelWeight || '400'

    // Resolve per-element font with fallback to global settings
    const resolveFont = (fontKey) => {
      const f = config[fontKey] || {}
      return {
        family: f.family || fontFamily,
        size: f.size || 12,
        weight: f.weight || labelWeight,
        color: f.color || '#666666',
        italic: f.italic || false
      }
    }

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background', Config.themes[config.theme]?.backgroundColor || '#fff')
      .style('font-family', fontFamily)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Extract field names from config (encoding-based mappings only, no fallbacks)
    const dimensionField = config.dimension
    const bar1Field = config.bar1Measure
    const bar2Field = config.bar2Measure
    const lineField = config.lineMeasure

    // Validate: need at least Category and one measure to render
    const hasDimension = !!dimensionField
    const hasMeasure = !!(bar1Field || bar2Field || lineField)

    if (!hasDimension || !hasMeasure) {
      const missingParts = []
      if (!hasDimension) missingParts.push('a Category dimension')
      if (!hasMeasure) missingParts.push('at least one measure')

      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#666')
        .text('Assign ' + missingParts.join(' and '))
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 + 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#999')
        .text('Use the marks card or open Settings to configure')
      return
    }

    // Prepare data
    const chartData = data.map(d => ({
      category: d[dimensionField]?.formattedValue || d[dimensionField]?.value,
      bar1: bar1Field ? (parseFloat(d[bar1Field]?.value) || 0) : 0,
      bar2: bar2Field ? (parseFloat(d[bar2Field]?.value) || 0) : 0,
      line: lineField ? (parseFloat(d[lineField]?.value) || 0) : 0
    }))

    // Apply x-axis sort order
    const xSort = config.xAxisSort || 'default'
    if (xSort === 'asc') {
      chartData.sort((a, b) => String(a.category).localeCompare(String(b.category)))
    } else if (xSort === 'desc') {
      chartData.sort((a, b) => String(b.category).localeCompare(String(a.category)))
    } else if (xSort === 'reverse') {
      chartData.reverse()
    }

    // Get easing function
    const easingFunctions = {
      'easeLinear': d3.easeLinear,
      'easeCubicOut': d3.easeCubicOut,
      'easeCubicInOut': d3.easeCubicInOut,
      'easeElastic': d3.easeElasticOut,
      'easeBounce': d3.easeBounceOut,
      'easeBack': d3.easeBackOut,
      'easeQuad': d3.easeQuadOut
    }
    const easing = easingFunctions[config.animationEasing] || d3.easeCubicOut

    // X Scale
    const x0 = d3.scaleBand()
      .domain(chartData.map(d => d.category))
      .range([0, chartWidth])
      .padding(config.barPadding)

    // Determine which series are active
    const hasBar1 = !!bar1Field
    const hasBar2 = !!bar2Field
    const hasLine = !!lineField

    // For grouped bars, create inner scale (only active bars)
    const activeBars = []
    if (hasBar1) activeBars.push('bar1')
    if (hasBar2) activeBars.push('bar2')

    const x1 = d3.scaleBand()
      .domain(activeBars.length > 0 ? activeBars : ['bar1'])
      .range([0, x0.bandwidth()])
      .padding(config.barGap / 100)

    // Y Scales
    let yLeftDomain, yRightDomain

    // Calculate domains with include zero option
    const bar1Values = hasBar1 ? chartData.map(d => d.bar1) : [0]
    const bar2Values = hasBar2 ? chartData.map(d => d.bar2) : [0]
    const lineValues = hasLine ? chartData.map(d => d.line) : [0]

    const bar1Max = d3.max(bar1Values)
    const bar2Max = d3.max(bar2Values)
    const bar1Min = d3.min(bar1Values)
    const bar2Min = d3.min(bar2Values)
    const lineMax = d3.max(lineValues)
    const lineMin = d3.min(lineValues)

    if (config.barStyle === 'stacked') {
      const stackedMax = d3.max(chartData, d => (hasBar1 ? d.bar1 : 0) + (hasBar2 ? d.bar2 : 0))
      const autoMin = config.yAxisLeftIncludeZero !== false ? 0 : Math.min(bar1Min, bar2Min) * 0.9
      yLeftDomain = [
        config.yAxisLeftMin !== null ? config.yAxisLeftMin : autoMin,
        config.yAxisLeftMax !== null ? config.yAxisLeftMax : (stackedMax || 1) * 1.1
      ]
    } else {
      const barMax = Math.max(bar1Max, bar2Max) || 1
      const barMin = Math.min(bar1Min, bar2Min)
      const autoMin = config.yAxisLeftIncludeZero !== false ? 0 : barMin * 0.9
      yLeftDomain = [
        config.yAxisLeftMin !== null ? config.yAxisLeftMin : autoMin,
        config.yAxisLeftMax !== null ? config.yAxisLeftMax : barMax * 1.1
      ]
    }

    const autoRightMin = config.yAxisRightIncludeZero !== false ? 0 : lineMin * 0.9
    yRightDomain = [
      config.yAxisRightMin !== null ? config.yAxisRightMin : autoRightMin,
      config.yAxisRightMax !== null ? config.yAxisRightMax : (lineMax || 1) * 1.1
    ]

    // Shared axis mode: combine all measures into one scale
    const isSharedAxis = isSharedAxisMode
    if (isSharedAxis) {
      const combinedMax = Math.max(bar1Max, bar2Max, lineMax) * 1.1
      const combinedMin = config.yAxisLeftIncludeZero !== false ? 0 : Math.min(bar1Min, bar2Min, lineMin) * 0.9
      yLeftDomain = [
        config.yAxisLeftMin !== null ? config.yAxisLeftMin : combinedMin,
        config.yAxisLeftMax !== null ? config.yAxisLeftMax : combinedMax
      ]
    }

    const yLeft = d3.scaleLinear()
      .domain(yLeftDomain)
      .nice()
      .range([chartHeight, 0])

    // In shared mode or syncDualAxis, right axis uses left scale domain
    const yRight = d3.scaleLinear()
      .domain((isSharedAxis || config.syncDualAxis) ? yLeftDomain : yRightDomain)
      .nice()

    // Line vertical position: compress yRight range to position line in a portion of the chart
    const linePos = config.lineVerticalPosition || 'auto'
    if (linePos !== 'auto') {
      const positionMap = { top: 0.25, upper: 0.40, middle: 0.55, lower: 0.70, bottom: 0.85 }
      const topFraction = positionMap[linePos] || 0
      yRight.range([chartHeight, chartHeight * topFraction])
    } else {
      yRight.range([chartHeight, 0])
    }

    // Draw grid
    if (config.gridHorizontal || config.gridVertical) {
      const gridGroup = g.append('g').attr('class', 'grid')

      if (config.gridHorizontal) {
        const hGrid = gridGroup.append('g')
          .call(d3.axisLeft(yLeft)
            .tickSize(-chartWidth)
            .tickFormat(''))
        hGrid.selectAll('line')
          .style('stroke', config.gridColor)
          .style('stroke-opacity', config.gridOpacity)
        hGrid.selectAll('text').remove()
        hGrid.select('.domain').remove()
      }

      if (config.gridVertical) {
        const vGrid = gridGroup.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(x0)
            .tickSize(-chartHeight)
            .tickFormat(''))
        vGrid.selectAll('line')
          .style('stroke', config.gridColor)
          .style('stroke-opacity', config.gridOpacity)
        vGrid.selectAll('text').remove()
        vGrid.select('.domain').remove()
      }
    }

    // Draw bars (only active series)
    if ((hasBar1 || hasBar2) && config.barStyle === 'grouped') {
      // Grouped bars
      const barGroup = g.selectAll('.bar-group')
        .data(chartData)
        .enter().append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => `translate(${x0(d.category)},0)`)

      // Bar 1
      let bar1Rects
      if (hasBar1) {
        bar1Rects = barGroup.append('rect')
          .attr('class', 'bar1')
          .attr('x', x1('bar1'))
          .attr('width', x1.bandwidth())
          .attr('y', chartHeight)
          .attr('height', 0)
          .attr('fill', config.bar1Color)
          .attr('opacity', config.bar1Opacity)
          .attr('rx', config.bar1CornerRadius)
          .attr('ry', config.bar1CornerRadius)

        if (config.bar1ShowBorder) {
          bar1Rects.attr('stroke', config.bar1BorderColor)
            .attr('stroke-width', config.bar1BorderWidth)
        }

        bar1Rects.transition()
          .duration(config.animationEnabled ? config.animationDuration : 0)
          .delay((d, i) => config.animationEnabled ? i * 20 : 0)
          .ease(easing)
          .attr('y', d => yLeft(d.bar1))
          .attr('height', d => chartHeight - yLeft(d.bar1))
      }

      // Bar 2
      let bar2Rects
      if (hasBar2) {
        bar2Rects = barGroup.append('rect')
          .attr('class', 'bar2')
          .attr('x', x1('bar2'))
          .attr('width', x1.bandwidth())
          .attr('y', chartHeight)
          .attr('height', 0)
          .attr('fill', config.bar2Color)
          .attr('opacity', config.bar2Opacity)
          .attr('rx', config.bar2CornerRadius)
          .attr('ry', config.bar2CornerRadius)

        if (config.bar2ShowBorder) {
          bar2Rects.attr('stroke', config.bar2BorderColor)
            .attr('stroke-width', config.bar2BorderWidth)
        }

        bar2Rects.transition()
          .duration(config.animationEnabled ? config.animationDuration : 0)
          .delay((d, i) => config.animationEnabled ? i * 20 + 50 : 0)
          .ease(easing)
          .attr('y', d => yLeft(d.bar2))
          .attr('height', d => chartHeight - yLeft(d.bar2))
      }

      // Bar 1 labels (independent config)
      if (config.bar1LabelsShow && hasBar1) {
        const b1Font = resolveFont('bar1LabelFont')
        const bar1LabelFmt = getFormatter(getFormatOpts(config, 'bar1Labels'))
        barGroup.append('text')
          .attr('class', 'bar1-label')
          .attr('x', x1('bar1') + x1.bandwidth() / 2 + (config.bar1LabelsOffsetX || 0))
          .attr('y', d => {
            const baseY = config.bar1LabelsPosition === 'top' ? yLeft(d.bar1) - 5
              : config.bar1LabelsPosition === 'center' ? yLeft(d.bar1) + (chartHeight - yLeft(d.bar1)) / 2
              : yLeft(d.bar1) + 15
            return baseY + (config.bar1LabelsOffsetY || 0)
          })
          .attr('text-anchor', 'middle')
          .attr('font-size', b1Font.size + 'px')
          .style('font-family', b1Font.family)
          .style('font-weight', b1Font.weight)
          .style('font-style', b1Font.italic ? 'italic' : 'normal')
          .attr('fill', b1Font.color)
          .text(d => bar1LabelFmt ? bar1LabelFmt(d.bar1) : d3.format(',')(d.bar1))
          .style('opacity', 0)
          .transition()
          .duration(config.animationEnabled ? config.animationDuration : 0)
          .style('opacity', 1)
      }

      // Bar 2 labels (independent config)
      if (config.bar2LabelsShow && hasBar2) {
        const b2Font = resolveFont('bar2LabelFont')
        const bar2LabelFmt = getFormatter(getFormatOpts(config, 'bar2Labels'))
        barGroup.append('text')
          .attr('class', 'bar2-label')
          .attr('x', x1('bar2') + x1.bandwidth() / 2 + (config.bar2LabelsOffsetX || 0))
          .attr('y', d => {
            const baseY = config.bar2LabelsPosition === 'top' ? yLeft(d.bar2) - 5
              : config.bar2LabelsPosition === 'center' ? yLeft(d.bar2) + (chartHeight - yLeft(d.bar2)) / 2
              : yLeft(d.bar2) + 15
            return baseY + (config.bar2LabelsOffsetY || 0)
          })
          .attr('text-anchor', 'middle')
          .attr('font-size', b2Font.size + 'px')
          .style('font-family', b2Font.family)
          .style('font-weight', b2Font.weight)
          .style('font-style', b2Font.italic ? 'italic' : 'normal')
          .attr('fill', b2Font.color)
          .text(d => bar2LabelFmt ? bar2LabelFmt(d.bar2) : d3.format(',')(d.bar2))
          .style('opacity', 0)
          .transition()
          .duration(config.animationEnabled ? config.animationDuration : 0)
          .style('opacity', 1)
      }

      // Tooltips for bars
      if (config.tooltipShow) {
        if (bar1Rects) {
          bar1Rects.on('mouseover', function(event, d) {
            showTooltip(event, d.category, 'bar1', d.bar1)
          }).on('mouseout', hideTooltip)
        }
        if (bar2Rects) {
          bar2Rects.on('mouseover', function(event, d) {
            showTooltip(event, d.category, 'bar2', d.bar2)
          }).on('mouseout', hideTooltip)
        }
      }

    } else if ((hasBar1 || hasBar2) && config.barStyle === 'stacked') {
      // Stacked bars
      const stackData = chartData.map(d => ({
        category: d.category,
        bar1: d.bar1,
        bar2: d.bar2,
        total: (hasBar1 ? d.bar1 : 0) + (hasBar2 ? d.bar2 : 0)
      }))

      const barGroup = g.selectAll('.bar-group')
        .data(stackData)
        .enter().append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => `translate(${x0(d.category)},0)`)

      // Bar 1 (bottom)
      let bar1Rects
      if (hasBar1) {
        bar1Rects = barGroup.append('rect')
          .attr('class', 'bar1')
          .attr('x', 0)
          .attr('width', x0.bandwidth())
          .attr('y', chartHeight)
          .attr('height', 0)
          .attr('fill', config.bar1Color)
          .attr('opacity', config.bar1Opacity)

        if (config.bar1ShowBorder) {
          bar1Rects.attr('stroke', config.bar1BorderColor)
            .attr('stroke-width', config.bar1BorderWidth)
        }

        bar1Rects.transition()
          .duration(config.animationEnabled ? config.animationDuration : 0)
          .ease(easing)
          .attr('y', d => yLeft(d.bar1))
          .attr('height', d => chartHeight - yLeft(d.bar1))
      }

      // Bar 2 (top - gets corner radius in stacked mode)
      let bar2Rects
      if (hasBar2) {
        bar2Rects = barGroup.append('rect')
          .attr('class', 'bar2')
          .attr('x', 0)
          .attr('width', x0.bandwidth())
          .attr('y', chartHeight)
          .attr('height', 0)
          .attr('fill', config.bar2Color)
          .attr('opacity', config.bar2Opacity)
          .attr('rx', config.bar2CornerRadius)

        if (config.bar2ShowBorder) {
          bar2Rects.attr('stroke', config.bar2BorderColor)
            .attr('stroke-width', config.bar2BorderWidth)
        }

        bar2Rects.transition()
          .duration(config.animationEnabled ? config.animationDuration : 0)
          .ease(easing)
          .attr('y', d => yLeft(d.total))
          .attr('height', d => yLeft(hasBar1 ? d.bar1 : 0) - yLeft(d.total))
      }

      // Tooltips for stacked bars
      if (config.tooltipShow) {
        if (bar1Rects) {
          bar1Rects.on('mouseover', function(event, d) {
            showTooltip(event, d.category, 'bar1', d.bar1)
          }).on('mouseout', hideTooltip)
        }
        if (bar2Rects) {
          bar2Rects.on('mouseover', function(event, d) {
            showTooltip(event, d.category, 'bar2', d.bar2)
          }).on('mouseout', hideTooltip)
        }
      }
    }

    // Draw line (only if line field is mapped)
    if (hasLine) {
      const lineCurves = {
        'linear': d3.curveLinear,
        'monotone': d3.curveMonotoneX,
        'cardinal': d3.curveCardinal,
        'step': d3.curveStepAfter
      }

      const line = d3.line()
        .x(d => x0(d.category) + x0.bandwidth() / 2)
        .y(d => yRight(d.line))
        .curve(lineCurves[config.lineCurve] || d3.curveLinear)

      const path = g.append('path')
        .datum(chartData)
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', config.lineColor)
        .attr('stroke-width', config.lineWidth)
        .attr('opacity', config.lineOpacity)
        .attr('d', line)

      // Line style
      if (config.lineStyle === 'dashed') {
        path.attr('stroke-dasharray', '8,4')
      } else if (config.lineStyle === 'dotted') {
        path.attr('stroke-dasharray', '2,2')
      }

      // Animate line
      if (config.animationEnabled) {
        const pathLength = path.node().getTotalLength()
        path
          .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
          .attr('stroke-dashoffset', pathLength)
          .transition()
          .duration(config.animationDuration * 1.2)
          .ease(easing)
          .attr('stroke-dashoffset', 0)
          .on('end', function() {
            if (config.lineStyle === 'dashed') {
              d3.select(this).attr('stroke-dasharray', '8,4')
            } else if (config.lineStyle === 'dotted') {
              d3.select(this).attr('stroke-dasharray', '2,2')
            } else {
              d3.select(this).attr('stroke-dasharray', null)
            }
          })
      }

      // Draw line points
      if (config.showPoints) {
        const pointsGroup = g.append('g').attr('class', 'points')

        const shapes = {
          'circle': d3.symbolCircle,
          'square': d3.symbolSquare,
          'diamond': d3.symbolDiamond,
          'triangle': d3.symbolTriangle
        }

        const pointSymbol = d3.symbol()
          .type(shapes[config.pointShape] || d3.symbolCircle)
          .size(config.pointSize * config.pointSize * 4)

        const points = pointsGroup.selectAll('.line-point')
          .data(chartData)
          .enter().append('path')
          .attr('class', 'line-point')
          .attr('transform', d => `translate(${x0(d.category) + x0.bandwidth() / 2},${yRight(d.line)})`)
          .attr('d', pointSymbol)
          .attr('fill', config.pointFill)
          .attr('stroke', config.pointStroke)
          .attr('stroke-width', config.pointStrokeWidth)
          .style('opacity', 0)

        points.transition()
          .duration(config.animationEnabled ? config.animationDuration * 0.5 : 0)
          .delay((d, i) => config.animationEnabled ? config.animationDuration * 0.8 + i * 30 : 0)
          .ease(easing)
          .style('opacity', 1)

        // Tooltips for points
        if (config.tooltipShow) {
          points.on('mouseover', function(event, d) {
            showTooltip(event, d.category, 'line', d.line)
          }).on('mouseout', hideTooltip)
        }

        // Line labels
        if (config.lineLabelsShow) {
          const lineLabelFmt = getFormatter(getFormatOpts(config, 'lineLabels'))
          const llFont = resolveFont('lineLabelFont')
          pointsGroup.selectAll('.line-label')
            .data(chartData)
            .enter().append('text')
            .attr('class', 'line-label')
            .attr('x', d => x0(d.category) + x0.bandwidth() / 2 + (config.lineLabelsOffsetX || 0))
            .attr('y', d => {
              const baseY = config.lineLabelsPosition === 'top' ? yRight(d.line) - 10
                : config.lineLabelsPosition === 'bottom' ? yRight(d.line) + 15
                : yRight(d.line) + 5
              return baseY + (config.lineLabelsOffsetY || 0)
            })
            .attr('text-anchor', 'middle')
            .attr('font-size', llFont.size + 'px')
            .style('font-family', llFont.family)
            .style('font-weight', llFont.weight)
            .style('font-style', llFont.italic ? 'italic' : 'normal')
            .attr('fill', llFont.color)
            .text(d => lineLabelFmt ? lineLabelFmt(d.line) : d3.format(',')(d.line))
            .style('opacity', 0)
            .transition()
            .duration(config.animationEnabled ? config.animationDuration : 0)
            .style('opacity', 1)
        }
      }
    }

    // Draw axes
    if (config.xAxisShow) {
      const xAxisGenerator = d3.axisBottom(x0)

      if (!config.xAxisShowLabels) {
        xAxisGenerator.tickFormat('')
      } else {
        const xFmt = getFormatter(getFormatOpts(config, 'xAxis'))
        if (xFmt) xAxisGenerator.tickFormat(xFmt)
      }
      if (!config.xAxisShowTickMarks) {
        xAxisGenerator.tickSize(0)
      }

      const xFont = resolveFont('xAxisFont')
      const xLabelFont = resolveFont('xAxisLabelFont')
      const xAxisGroup = g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(xAxisGenerator)
        .style('color', xFont.color)
        .style('font-family', xFont.family)
        .style('font-weight', xFont.weight)
        .style('font-size', xFont.size + 'px')
        .style('font-style', xFont.italic ? 'italic' : 'normal')

      // Apply separate label font to tick text
      xAxisGroup.selectAll('.tick text')
        .style('font-family', xLabelFont.family)
        .style('font-weight', xLabelFont.weight)
        .style('font-size', xLabelFont.size + 'px')
        .style('font-style', xLabelFont.italic ? 'italic' : 'normal')
        .style('fill', xLabelFont.color)

      // Tick and axis line colors
      xAxisGroup.selectAll('.tick line').style('stroke', config.xAxisTickColor || '#999')
      xAxisGroup.select('.domain').style('stroke', config.xAxisLineColor || '#999')

      if (config.xAxisRotation !== 0) {
        xAxisGroup.selectAll('text')
          .attr('transform', `rotate(${config.xAxisRotation})`)
          .style('text-anchor', 'end')
          .attr('dx', '-0.8em')
          .attr('dy', '0.15em')
      } else {
        // Apply x-axis label alignment
        const xAlign = config.xAxisAlign || 'center'
        if (xAlign !== 'center') {
          xAxisGroup.selectAll('.tick text')
            .style('text-anchor', xAlign === 'left' ? 'start' : 'end')
        }
      }

      // Apply label offsets
      if (config.xAxisLabelOffsetX || config.xAxisLabelOffsetY) {
        xAxisGroup.selectAll('.tick text')
          .attr('dx', (config.xAxisLabelOffsetX || 0) + 'px')
          .attr('dy', (config.xAxisLabelOffsetY || 10) + 'px')
      }

      if (!config.xAxisShowAxisLine) {
        xAxisGroup.select('.domain').remove()
      }

      // X Axis Title (offset adjusts for rotated labels)
      // Falls back to dimension field name if no custom title set
      const xTitle = config.xAxisTitle || getDisplayName('dimension', fieldNames, config)
      if (config.xAxisShowTitle && xTitle) {
        const absRotation = Math.abs(config.xAxisRotation || 0)
        const titleYOffset = absRotation === 0 ? 45 : absRotation <= 45 ? 60 : 75
        xAxisGroup.append('text')
          .attr('class', 'x-axis-title')
          .attr('x', chartWidth / 2)
          .attr('y', titleYOffset)
          .attr('text-anchor', 'middle')
          .attr('font-size', (xFont.size + 1) + 'px')
          .style('font-family', xFont.family)
          .style('font-weight', Math.min(700, xFont.weight + 100))
          .attr('fill', xFont.color)
          .text(xTitle)
      }
    }

    if (config.yAxisLeftShow) {
      const yAxisLeftGenerator = d3.axisLeft(yLeft)

      if (!config.yAxisLeftShowLabels) {
        yAxisLeftGenerator.tickFormat('')
      } else {
        const leftFmt = getFormatter(getFormatOpts(config, 'yAxisLeft'))
        if (leftFmt) yAxisLeftGenerator.tickFormat(leftFmt)
      }
      if (!config.yAxisLeftShowTickMarks) {
        yAxisLeftGenerator.tickSize(0)
      }

      const yLeftFont = resolveFont('yAxisLeftFont')
      const yLeftLabelFont = resolveFont('yAxisLeftLabelFont')
      const yAxisLeftGroup = g.append('g')
        .attr('class', 'y-axis-left')
        .call(yAxisLeftGenerator)
        .style('color', yLeftFont.color)
        .style('font-family', yLeftFont.family)
        .style('font-weight', yLeftFont.weight)
        .style('font-size', yLeftFont.size + 'px')
        .style('font-style', yLeftFont.italic ? 'italic' : 'normal')

      // Apply separate label font to tick text
      yAxisLeftGroup.selectAll('.tick text')
        .style('font-family', yLeftLabelFont.family)
        .style('font-weight', yLeftLabelFont.weight)
        .style('font-size', yLeftLabelFont.size + 'px')
        .style('font-style', yLeftLabelFont.italic ? 'italic' : 'normal')
        .style('fill', yLeftLabelFont.color)

      // Tick and axis line colors
      yAxisLeftGroup.selectAll('.tick line').style('stroke', config.yAxisLeftTickColor || '#999')
      yAxisLeftGroup.select('.domain').style('stroke', config.yAxisLeftLineColor || '#999')

      // Label offsets
      if (config.yAxisLeftLabelOffsetX || config.yAxisLeftLabelOffsetY) {
        yAxisLeftGroup.selectAll('.tick text')
          .attr('dx', (config.yAxisLeftLabelOffsetX || 0) + 'px')
          .attr('dy', (config.yAxisLeftLabelOffsetY || 0) + 'px')
      }

      if (!config.yAxisLeftShowAxisLine) {
        yAxisLeftGroup.select('.domain').remove()
      }

      // Y Axis Left Title
      // Falls back to "Bar1Name / Bar2Name" from field names
      const leftParts = [getDisplayName('bar1', fieldNames, config), getDisplayName('bar2', fieldNames, config)].filter(Boolean)
      const yLeftTitle = config.yAxisLeftTitle || leftParts.join(' / ')
      if (config.yAxisLeftShowTitle && yLeftTitle) {
        const titleXOffset = -Math.max(margin.left - 10, 60)
        g.append('text')
          .attr('class', 'y-axis-left-title')
          .attr('transform', 'rotate(-90)')
          .attr('x', -chartHeight / 2)
          .attr('y', titleXOffset)
          .attr('text-anchor', 'middle')
          .attr('font-size', (yLeftFont.size + 1) + 'px')
          .style('font-family', yLeftFont.family)
          .style('font-weight', Math.min(700, yLeftFont.weight + 100))
          .attr('fill', yLeftFont.color)
          .text(yLeftTitle)
      }
    }

    // Right axis only in dual mode (hidden in shared mode)
    if (config.yAxisRightShow && hasLine && !isSharedAxis) {
      const yAxisRightGenerator = d3.axisRight(yRight)

      if (!config.yAxisRightShowLabels) {
        yAxisRightGenerator.tickFormat('')
      } else {
        const rightFmt = getFormatter(getFormatOpts(config, 'yAxisRight'))
        if (rightFmt) yAxisRightGenerator.tickFormat(rightFmt)
      }
      if (!config.yAxisRightShowTickMarks) {
        yAxisRightGenerator.tickSize(0)
      }

      const yRightFont = resolveFont('yAxisRightFont')
      const yRightLabelFont = resolveFont('yAxisRightLabelFont')
      const yAxisRightGroup = g.append('g')
        .attr('class', 'y-axis-right')
        .attr('transform', `translate(${chartWidth},0)`)
        .call(yAxisRightGenerator)
        .style('color', yRightFont.color)
        .style('font-family', yRightFont.family)
        .style('font-weight', yRightFont.weight)
        .style('font-size', yRightFont.size + 'px')
        .style('font-style', yRightFont.italic ? 'italic' : 'normal')

      // Apply separate label font to tick text
      yAxisRightGroup.selectAll('.tick text')
        .style('font-family', yRightLabelFont.family)
        .style('font-weight', yRightLabelFont.weight)
        .style('font-size', yRightLabelFont.size + 'px')
        .style('font-style', yRightLabelFont.italic ? 'italic' : 'normal')
        .style('fill', yRightLabelFont.color)

      // Tick and axis line colors
      yAxisRightGroup.selectAll('.tick line').style('stroke', config.yAxisRightTickColor || '#999')
      yAxisRightGroup.select('.domain').style('stroke', config.yAxisRightLineColor || '#999')

      // Label offsets
      if (config.yAxisRightLabelOffsetX || config.yAxisRightLabelOffsetY) {
        yAxisRightGroup.selectAll('.tick text')
          .attr('dx', (config.yAxisRightLabelOffsetX || 0) + 'px')
          .attr('dy', (config.yAxisRightLabelOffsetY || 0) + 'px')
      }

      if (!config.yAxisRightShowAxisLine) {
        yAxisRightGroup.select('.domain').remove()
      }

      // Y Axis Right Title
      // Falls back to line field name
      const yRightTitle = config.yAxisRightTitle || getDisplayName('line', fieldNames, config)
      if (config.yAxisRightShowTitle && yRightTitle) {
        const titleXOffset = -Math.max(margin.right - 15, 45)
        yAxisRightGroup.append('text')
          .attr('class', 'y-axis-right-title')
          .attr('transform', 'rotate(90)')
          .attr('x', chartHeight / 2)
          .attr('y', titleXOffset)
          .attr('text-anchor', 'middle')
          .attr('font-size', (yRightFont.size + 1) + 'px')
          .style('font-family', yRightFont.family)
          .style('font-weight', Math.min(700, yRightFont.weight + 100))
          .attr('fill', yRightFont.color)
          .text(yRightTitle)
      }
    }

    // Title is rendered in the DOM header (App.jsx), not in SVG
    // Legend is rendered as DOM elements below the SVG (see JSX return)

    // Tooltip functions
    function showTooltip(event, category, type, value) {
      if (!tooltipRef.current) return

      const tooltip = d3.select(tooltipRef.current)
      const displayName = getDisplayName(type, fieldNames, config)

      let content = ''

      // Custom template mode
      if (config.tooltipUseCustom && config.tooltipTemplate) {
        // Get all display names
        const dimensionLabel = getDisplayName('dimension', fieldNames, config)
        const bar1Label = getDisplayName('bar1', fieldNames, config)
        const bar2Label = getDisplayName('bar2', fieldNames, config)
        const lineLabel = getDisplayName('line', fieldNames, config)

        // Find the data point to get all values
        const dataPoint = chartData.find(d => d.category === category)
        const bar1Formatted = dataPoint?.bar1 != null ? d3.format(',.2f')(dataPoint.bar1) : ''
        const bar2Formatted = dataPoint?.bar2 != null ? d3.format(',.2f')(dataPoint.bar2) : ''
        const lineFormatted = dataPoint?.line != null ? d3.format(',.2f')(dataPoint.line) : ''
        const valueFormatted = d3.format(',.2f')(value)

        // Parse template line by line
        const lines = config.tooltipTemplate.split('\n')
        lines.forEach(line => {
          const rendered = line
            .replace(/\{dimension_label\}/g, dimensionLabel)
            .replace(/\{dimension\}/g, category)
            .replace(/\{bar1_label\}/g, bar1Label)
            .replace(/\{bar1_value\}/g, bar1Formatted)
            .replace(/\{bar1\}/g, `${bar1Label} : ${bar1Formatted}`)
            .replace(/\{bar2_label\}/g, bar2Label)
            .replace(/\{bar2_value\}/g, bar2Formatted)
            .replace(/\{bar2\}/g, `${bar2Label} : ${bar2Formatted}`)
            .replace(/\{line_label\}/g, lineLabel)
            .replace(/\{line_value\}/g, lineFormatted)
            .replace(/\{line\}/g, `${lineLabel} : ${lineFormatted}`)
            .replace(/\{measure\}/g, displayName)
            .replace(/\{value\}/g, valueFormatted)

          if (rendered.trim()) {
            content += `<div class="tooltip-row">${rendered}</div>`
          }
        })
      }
      // Default mode
      else {
        if (config.tooltipShowDimension) {
          content += `<div class="tooltip-title"><strong>${category}</strong></div>`
        }
        if (config.tooltipShowMeasureName && config.tooltipShowValue) {
          content += `<div class="tooltip-row"><span class="tooltip-label">${displayName} :</span> <span class="tooltip-value">${d3.format(',.2f')(value)}</span></div>`
        } else if (config.tooltipShowMeasureName) {
          content += `<div class="tooltip-row">${displayName}</div>`
        } else if (config.tooltipShowValue) {
          content += `<div class="tooltip-row">${d3.format(',.2f')(value)}</div>`
        }
      }

      tooltip
        .style('display', 'block')
        .html(content)

      // Position with viewport boundary checking
      const tooltipNode = tooltipRef.current
      const tooltipRect = tooltipNode.getBoundingClientRect()
      let left = event.clientX + 15
      let top = event.clientY - 10

      if (left + tooltipRect.width > window.innerWidth) {
        left = event.clientX - tooltipRect.width - 15
      }
      if (top + tooltipRect.height > window.innerHeight) {
        top = event.clientY - tooltipRect.height - 10
      }
      if (top < 0) top = 5

      tooltip
        .style('left', left + 'px')
        .style('top', top + 'px')
    }

    function hideTooltip() {
      if (!tooltipRef.current) return
      d3.select(tooltipRef.current).style('display', 'none')
    }

  }, [data, columns, config])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      Promise.resolve().then(() => {
        if (svgRef.current) {
          // Chart will re-render via the main useEffect
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No data available</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Add fields to the marks card or check your data source
        </p>
      </div>
    )
  }

  // Compute unmapped fields for hint below chart
  const unmappedFields = []
  if (!config.bar1Measure) unmappedFields.push('Bar 1')
  if (!config.bar2Measure) unmappedFields.push('Bar 2')
  if (!config.lineMeasure) unmappedFields.push('Line')

  const hintText = (unmappedFields.length > 0 && unmappedFields.length < 3)
    ? (unmappedFields.length === 1
        ? `Tip: Add a field to ${unmappedFields[0]} on the marks card to display it`
        : `Tip: Add fields to ${unmappedFields.join(' and ')} on the marks card to display them`)
    : null

  // Get field names for display names
  const fieldNames = getFieldNames(config)

  // Build legend data for DOM rendering
  const legendData = []
  if (config.bar1Measure) {
    legendData.push({
      label: getDisplayName('bar1', fieldNames, config),
      color: config.bar1Color,
      type: 'bar'
    })
  }
  if (config.bar2Measure) {
    legendData.push({
      label: getDisplayName('bar2', fieldNames, config),
      color: config.bar2Color,
      type: 'bar'
    })
  }
  if (config.lineMeasure) {
    legendData.push({
      label: getDisplayName('line', fieldNames, config),
      color: config.lineColor,
      type: 'line'
    })
  }

  const isVerticalLegend = config.legendPosition === 'left' || config.legendPosition === 'right'
  const fontFamily = config.fontFamily || '"Tableau Book", Arial, sans-serif'
  const themeColors = Config.themes[config.theme] || Config.themes.light
  const legendBorder = config.showLegendBorder
    ? `${config.legendBorderWidth || 1}px ${config.legendBorderStyle || 'solid'} ${config.legendBorderColor || themeColors.gridColor || '#e0e0e0'}`
    : 'none'
  const lgFont = config.legendFont || {}
  const legendLayout = config.legendLayout || 'wrap'
  const vAlign = config.legendVerticalAlign || 'top'
  const hAlignMap = { left: 'flex-start', center: 'center', right: 'flex-end' }
  const vAlignMap = { top: 'flex-start', center: 'center', bottom: 'flex-end' }

  const legendPad = config.legendPadding !== undefined ? config.legendPadding : 14
  const legendGap = config.legendGap !== undefined ? config.legendGap : 24

  const legendStyle = {
    display: 'flex',
    flexShrink: 0,
    fontFamily: lgFont.family || fontFamily,
    fontSize: (lgFont.size || 13) + 'px',
    fontWeight: lgFont.weight || 500,
    fontStyle: lgFont.italic ? 'italic' : 'normal',
    color: lgFont.color || themeColors.axisColor || '#666',
    background: config.legendBgColor && config.legendBgColor !== 'transparent'
      ? config.legendBgColor
      : 'transparent',
    border: 'none',
    ...(isVerticalLegend ? {
      // Side legends: column layout, width constrained via CSS
      flexDirection: 'column',
      flexWrap: 'nowrap',
      alignItems: hAlignMap[config.legendAlign] || 'flex-start',
      gap: legendGap > 24 ? legendGap + 'px' : '10px',
      padding: `${legendPad}px 14px`,
      width: 'auto',
    } : {
      // Top/bottom legends: row or column layout based on setting
      flexDirection: legendLayout === 'nowrap' ? 'row' : 'column',
      flexWrap: 'nowrap',
      justifyContent: legendLayout === 'nowrap' ? hAlignMap[config.legendAlign] || 'center' : 'flex-start',
      alignItems: legendLayout === 'nowrap' ? 'center' : hAlignMap[config.legendAlign] || 'center',
      gap: legendGap + 'px',
      padding: `${legendPad}px 20px`,
      width: '100%',
      ...(legendLayout === 'nowrap' ? { overflow: 'hidden' } : {}),
    }),
  }

  // Position-specific border (adjacent to chart edge)
  const legendBorderStyle = (pos) => {
    if (pos === 'top') return { borderBottom: legendBorder }
    if (pos === 'bottom') return { borderTop: legendBorder }
    if (pos === 'left') return { borderRight: legendBorder }
    if (pos === 'right') return { borderLeft: legendBorder }
    return {}
  }

  const legendEl = config.showLegend && legendData.length > 0 && (
    <div className="chart-legend" style={{
      ...legendStyle,
      ...legendBorderStyle(config.legendPosition),
      ...(isVerticalLegend ? { alignSelf: vAlignMap[vAlign] || 'start' } : {}),
    }}>
      {legendData.map((item, i) => (
        <div key={i} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {item.type === 'bar'
            ? <div style={{ width: 14, height: 14, backgroundColor: item.color, borderRadius: 4, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
            : <div style={{ width: 20, height: 3, backgroundColor: item.color, borderRadius: 9999, flexShrink: 0 }} />
          }
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )

  const chartEl = (
    <div ref={containerRef} className="combo-chart-container">
      <svg ref={svgRef}></svg>
    </div>
  )

  const pos = config.legendPosition || 'bottom'

  return (
    <>
      {isVerticalLegend ? (
        <div className={`chart-with-side-legend legend-layout-${pos}`} style={{
          flex: '1 1 auto', minHeight: 0, overflow: 'hidden'
        }}>
          {pos === 'left' && legendEl}
          {chartEl}
          {pos === 'right' && legendEl}
        </div>
      ) : (
        <>
          {pos === 'top' && legendEl}
          {chartEl}
          {pos === 'bottom' && legendEl}
        </>
      )}
      {hintText && (
        <div className="chart-hint">{hintText}</div>
      )}
      {config.tooltipShow && (() => {
        const ttFont = config.tooltipFont || {}
        return (
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              display: 'none',
              background: config.tooltipBgColor,
              color: ttFont.color || config.tooltipTextColor,
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: (ttFont.size || config.tooltipFontSize) + 'px',
              fontFamily: ttFont.family || fontFamily,
              fontWeight: ttFont.weight || 400,
              fontStyle: ttFont.italic ? 'italic' : 'normal',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          />
        )
      })()}
    </>
  )
}

export default ComboChart
