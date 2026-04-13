import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import PnLHistoryChart from './PnLHistoryChart'
import { usePortfolioStore } from '@/stores/portfolioStore'

const mockRemove = vi.fn()
const mockResize = vi.fn()
const mockSetData = vi.fn()
const mockFitContent = vi.fn()

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: mockSetData,
      update: vi.fn(),
    })),
    remove: mockRemove,
    resize: mockResize,
    timeScale: () => ({ fitContent: mockFitContent }),
  })),
  LineSeries: 'LineSeries',
  ColorType: { Solid: 'Solid' },
}))

const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
class MockResizeObserver {
  observe = mockObserve
  disconnect = mockDisconnect
  unobserve = vi.fn()
  constructor(public callback: ResizeObserverCallback) {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

beforeEach(() => {
  vi.clearAllMocks()
  usePortfolioStore.setState({ portfolio: null, history: null, isLoading: false })
})

describe('PnLHistoryChart', () => {
  it('shows empty state text when history is null', () => {
    const { getByText } = render(<PnLHistoryChart />)
    expect(getByText(/No history yet/)).toBeTruthy()
  })

  it('shows empty state text when history is empty array', () => {
    usePortfolioStore.setState({ history: [] })
    const { getByText } = render(<PnLHistoryChart />)
    expect(getByText(/No history yet/)).toBeTruthy()
  })

  it('renders chart container when history has data', () => {
    usePortfolioStore.setState({
      history: [
        { recorded_at: '2026-04-12T10:00:00Z', total_value: 10000 },
        { recorded_at: '2026-04-12T10:00:30Z', total_value: 10050 },
      ],
    })
    const { container } = render(<PnLHistoryChart />)
    // Container should not have invisible class when data exists
    const chartDiv = container.querySelector('.w-full.h-full:not(.invisible)')
    expect(chartDiv).toBeTruthy()
  })

  it('calls createChart with dark theme config', async () => {
    usePortfolioStore.setState({
      history: [{ recorded_at: '2026-04-12T10:00:00Z', total_value: 10000 }],
    })
    render(<PnLHistoryChart />)
    const { createChart } = await import('lightweight-charts')
    expect(createChart).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        layout: expect.objectContaining({
          background: expect.objectContaining({ color: '#0d1117' }),
          textColor: '#8b949e',
        }),
        grid: expect.objectContaining({
          vertLines: expect.objectContaining({ color: '#30363d' }),
          horzLines: expect.objectContaining({ color: '#30363d' }),
        }),
      }),
    )
  })

  it('calls addSeries with LineSeries and blue color', async () => {
    usePortfolioStore.setState({
      history: [{ recorded_at: '2026-04-12T10:00:00Z', total_value: 10000 }],
    })
    render(<PnLHistoryChart />)
    const { createChart } = await import('lightweight-charts')
    const chartInstance = (createChart as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(chartInstance.addSeries).toHaveBeenCalledWith(
      'LineSeries',
      expect.objectContaining({
        color: '#209dd7',
        lineWidth: 2,
      }),
    )
  })

  it('cleans up chart on unmount', () => {
    usePortfolioStore.setState({
      history: [{ recorded_at: '2026-04-12T10:00:00Z', total_value: 10000 }],
    })
    const { unmount } = render(<PnLHistoryChart />)
    unmount()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('sets data on series when history has data', () => {
    usePortfolioStore.setState({
      history: [
        { recorded_at: '2026-04-12T10:00:00Z', total_value: 10000 },
        { recorded_at: '2026-04-12T10:00:30Z', total_value: 10050 },
      ],
    })
    render(<PnLHistoryChart />)
    expect(mockSetData).toHaveBeenCalledWith([
      { time: '2026-04-12T10:00:00Z', value: 10000 },
      { time: '2026-04-12T10:00:30Z', value: 10050 },
    ])
  })
})
