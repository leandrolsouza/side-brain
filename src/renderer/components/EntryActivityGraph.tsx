import React, { useState, useEffect, useMemo } from 'react'
import { Flame } from 'lucide-react'

interface ActivityDay {
  date: string
  count: number
}

const WEEKS = 20

function getLevel(count: number): number {
  if (count === 0) return 0
  if (count < 3) return 1
  if (count < 5) return 2
  if (count < 8) return 3
  return 4
}

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const CELL_SIZE = 11
const CELL_GAP = 2
const COL_WIDTH = CELL_SIZE + CELL_GAP // 13px per column

function getMonthLabels(startDate: Date, totalDays: number): { label: string; leftPx: number }[] {
  const labels: { label: string; leftPx: number }[] = []
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  let lastMonth = -1

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const month = d.getMonth()
    if (month !== lastMonth) {
      const col = Math.floor(i / 7)
      labels.push({ label: months[month], leftPx: col * COL_WIDTH })
      lastMonth = month
    }
  }

  return labels
}

function getCurrentStreak(dayMap: Map<string, number>): number {
  let streak = 0
  const today = new Date()
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = toLocalDateStr(d)
    const count = dayMap.get(key) || 0
    if (count > 0) {
      streak++
    } else if (i > 0) {
      break
    } else {
      continue
    }
  }
  return streak
}

function getLongestStreak(dayMap: Map<string, number>, startDate: Date, totalDays: number): number {
  let longest = 0
  let current = 0

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = toLocalDateStr(d)
    const count = dayMap.get(key) || 0
    if (count > 0) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }

  return longest
}

export function EntryActivityGraph() {
  const [activityData, setActivityData] = useState<ActivityDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tooltipData, setTooltipData] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await window.electronAPI.getEntryActivityHeatmap(WEEKS)
      setActivityData(data)
    } catch (e) {
      console.error('Failed to load activity heatmap:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const { grid, startDate, totalDays, dayMap, totalEntries } = useMemo(() => {
    // Build a map of date -> count
    const dayMap = new Map<string, number>()
    let totalEntries = 0
    for (const item of activityData) {
      dayMap.set(item.date, item.count)
      totalEntries += item.count
    }

    // Calculate start date (beginning of the week, WEEKS ago)
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday
    const totalDays = WEEKS * 7 + dayOfWeek + 1
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - totalDays + 1)

    // Build grid: columns = weeks, rows = days of week
    const grid: { date: string; count: number; level: number }[][] = []

    for (let week = 0; week < Math.ceil(totalDays / 7); week++) {
      const column: { date: string; count: number; level: number }[] = []
      for (let day = 0; day < 7; day++) {
        const cellIndex = week * 7 + day
        if (cellIndex >= totalDays) {
          column.push({ date: '', count: 0, level: -1 }) // empty cell
        } else {
          const d = new Date(startDate)
          d.setDate(startDate.getDate() + cellIndex)
          const dateStr = toLocalDateStr(d)
          const count = dayMap.get(dateStr) || 0
          column.push({ date: dateStr, count, level: getLevel(count) })
        }
      }
      grid.push(column)
    }

    return { grid, startDate, totalDays, dayMap, totalEntries }
  }, [activityData])

  const monthLabels = useMemo(() => getMonthLabels(startDate, totalDays), [startDate, totalDays])
  const currentStreak = useMemo(() => getCurrentStreak(dayMap), [dayMap])
  const longestStreak = useMemo(() => getLongestStreak(dayMap, startDate, totalDays), [dayMap, startDate, totalDays])

  const handleCellHover = (e: React.MouseEvent, date: string, count: number) => {
    if (!date) return
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const container = (e.target as HTMLElement).closest('.activity-graph-grid')
    const containerRect = container?.getBoundingClientRect()
    if (containerRect) {
      setTooltipData({
        date,
        count,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 4,
      })
    }
  }

  const handleCellLeave = () => {
    setTooltipData(null)
  }

  const formatTooltipDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  if (isLoading) {
    return (
      <div className="dashboard-card">
        <h3 className="dashboard-card-title">
          <Flame size={14} />
          Atividade de Registros
        </h3>
        <div className="activity-graph-loading">Carregando...</div>
      </div>
    )
  }

  const dayLabels = ['Dom', '', 'Ter', '', 'Qui', '', 'Sáb']

  return (
    <div className="dashboard-card">
      <h3 className="dashboard-card-title">
        <Flame size={14} />
        Atividade de Registros
      </h3>

      {/* Stats row */}
      <div className="activity-graph-stats">
        <div className="activity-stat">
          <span className="activity-stat-value">{totalEntries}</span>
          <span className="activity-stat-label">registros ({WEEKS} semanas)</span>
        </div>
        <div className="activity-stat">
          <span className="activity-stat-value">{currentStreak}</span>
          <span className="activity-stat-label">dias seguidos</span>
        </div>
        <div className="activity-stat">
          <span className="activity-stat-value">{longestStreak}</span>
          <span className="activity-stat-label">maior sequência</span>
        </div>
      </div>

      {/* Graph */}
      <div className="activity-graph-container">
        {/* Month labels */}
        <div className="activity-graph-months">
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="activity-graph-month"
              style={{ left: `${m.leftPx}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="activity-graph-body">
          {/* Day labels */}
          <div className="activity-graph-day-labels">
            {dayLabels.map((label, i) => (
              <span key={i} className="activity-graph-day-label">{label}</span>
            ))}
          </div>

          {/* Grid */}
          <div className="activity-graph-grid">
            {grid.map((week, wi) => (
              <div key={wi} className="activity-graph-week">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`activity-graph-cell ${day.level >= 0 ? `level-${day.level}` : 'empty'}`}
                    onMouseEnter={(e) => handleCellHover(e, day.date, day.count)}
                    onMouseLeave={handleCellLeave}
                  />
                ))}
              </div>
            ))}

            {/* Tooltip */}
            {tooltipData && (
              <div
                className="activity-graph-tooltip"
                style={{ left: tooltipData.x, top: tooltipData.y }}
              >
                <strong>{tooltipData.count} {tooltipData.count === 1 ? 'registro' : 'registros'}</strong>
                <span>{formatTooltipDate(tooltipData.date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="activity-graph-legend">
        <span className="activity-graph-legend-label">Menos</span>
        <div className="activity-graph-cell level-0" />
        <div className="activity-graph-cell level-1" />
        <div className="activity-graph-cell level-2" />
        <div className="activity-graph-cell level-3" />
        <div className="activity-graph-cell level-4" />
        <span className="activity-graph-legend-label">Mais</span>
      </div>
    </div>
  )
}
