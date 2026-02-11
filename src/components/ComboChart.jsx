import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

function ComboChart({ data, columns, config }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove()

    // Get dimensions
    const container = containerRef.current
    const width = container.clientWidth
    const height = config.height
    const margin = config.margins

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Extract field names
    const dimensionField = columns[0]?.fieldName
    const bar1Field = columns[1]?.fieldName
    const bar2Field = columns[2]?.fieldName
    const lineField = columns[3]?.fieldName

    // Prepare data
    const chartData = data.map(d => ({
      category: d[dimensionField]?.formattedValue || d[dimensionField]?.value,
      bar1: parseFloat(d[bar1Field]?.value) || 0,
      bar2: parseFloat(d[bar2Field]?.value) || 0,
      line: parseFloat(d[lineField]?.value) || 0
    }))

    // Scales
    const x0 = d3.scaleBand()
      .domain(chartData.map(d => d.category))
      .range([0, chartWidth])
      .padding(config.barPadding)

    const x1 = d3.scaleBand()
      .domain(['bar1', 'bar2'])
      .range([0, x0.bandwidth()])
      .padding(0.05)

    const yLeft = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => Math.max(d.bar1, d.bar2))])
      .nice()
      .range([chartHeight, 0])

    const yRight = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.line)])
      .nice()
      .range([chartHeight, 0])

    // Axes
    const xAxis = d3.axisBottom(x0)
    const yAxisLeft = d3.axisLeft(yLeft)
    const yAxisRight = d3.axisRight(yRight)

    // Draw grid
    if (config.showGrid) {
      g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yLeft)
          .tickSize(-chartWidth)
          .tickFormat(''))
        .style('stroke', config.themes[config.theme]?.gridColor || '#e0e0e0')
        .style('stroke-opacity', 0.1)
    }

    // Draw bars
    const barGroup = g.selectAll('.bar-group')
      .data(chartData)
      .enter().append('g')
      .attr('class', 'bar-group')
      .attr('transform', d => `translate(${x0(d.category)},0)`)

    barGroup.append('rect')
      .attr('class', 'bar1')
      .attr('x', x1('bar1'))
      .attr('width', x1.bandwidth())
      .attr('y', chartHeight)
      .attr('height', 0)
      .attr('fill', config.bar1Color)
      .attr('opacity', config.barOpacity)
      .transition()
      .duration(config.animationEnabled ? 800 : 0)
      .attr('y', d => yLeft(d.bar1))
      .attr('height', d => chartHeight - yLeft(d.bar1))

    barGroup.append('rect')
      .attr('class', 'bar2')
      .attr('x', x1('bar2'))
      .attr('width', x1.bandwidth())
      .attr('y', chartHeight)
      .attr('height', 0)
      .attr('fill', config.bar2Color)
      .attr('opacity', config.barOpacity)
      .transition()
      .duration(config.animationEnabled ? 800 : 0)
      .attr('y', d => yLeft(d.bar2))
      .attr('height', d => chartHeight - yLeft(d.bar2))

    // Draw line
    const line = d3.line()
      .x(d => x0(d.category) + x0.bandwidth() / 2)
      .y(d => yRight(d.line))

    const path = g.append('path')
      .datum(chartData)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', config.lineColor)
      .attr('stroke-width', config.lineWidth)
      .attr('d', line)

    if (config.animationEnabled) {
      const pathLength = path.node().getTotalLength()
      path
        .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
        .attr('stroke-dashoffset', pathLength)
        .transition()
        .duration(1200)
        .attr('stroke-dashoffset', 0)
    }

    // Draw line points
    if (config.showPoints) {
      g.selectAll('.line-point')
        .data(chartData)
        .enter().append('circle')
        .attr('class', 'line-point')
        .attr('cx', d => x0(d.category) + x0.bandwidth() / 2)
        .attr('cy', d => yRight(d.line))
        .attr('r', 0)
        .attr('fill', config.lineColor)
        .transition()
        .duration(config.animationEnabled ? 800 : 0)
        .delay((d, i) => config.animationEnabled ? i * 50 : 0)
        .attr('r', config.pointRadius)
    }

    // Draw axes
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis)
      .style('color', config.themes[config.theme]?.axisColor || '#666')

    g.append('g')
      .attr('class', 'y-axis-left')
      .call(yAxisLeft)
      .style('color', config.themes[config.theme]?.axisColor || '#666')

    g.append('g')
      .attr('class', 'y-axis-right')
      .attr('transform', `translate(${chartWidth},0)`)
      .call(yAxisRight)
      .style('color', config.themes[config.theme]?.axisColor || '#666')

    // Legend
    if (config.showLegend) {
      const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 150}, 10)`)

      const legendData = [
        { label: bar1Field || 'Bar 1', color: config.bar1Color },
        { label: bar2Field || 'Bar 2', color: config.bar2Color },
        { label: lineField || 'Line', color: config.lineColor }
      ]

      legendData.forEach((item, i) => {
        const legendItem = legend.append('g')
          .attr('transform', `translate(0, ${i * 20})`)

        legendItem.append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('fill', item.color)

        legendItem.append('text')
          .attr('x', 18)
          .attr('y', 10)
          .text(item.label)
          .style('font-size', '12px')
          .style('fill', config.themes[config.theme]?.textColor || '#333')
      })
    }

  }, [data, columns, config])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Trigger re-render by creating a microtask
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
          Drag dimensions and measures to the marks card
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="combo-chart-container">
      <svg ref={svgRef}></svg>
    </div>
  )
}

export default ComboChart
