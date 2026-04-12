import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import MainChart from './MainChart'
import { usePriceStore } from '@/stores/priceStore'

const mockRemove = vi.fn()
const mockResize = vi.fn()
const mockSetData = vi.fn()
const mockUpdate = vi.fn()
const mockFitContent = vi.fn()

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: mockSetData,
      update: mockUpdate,
    })),
    remove: mockRemove,
    resize: mockResize,
    timeScale: () => ({ fitContent: mockFitContent }),
    applyOptions: vi.fn(),
  })),
  LineSeries: 'LineSeries',
  ColorType: { Solid: 'Solid' },
}))

// Mock ResizeObserver
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
  usePriceStore.setState({
    prices: {},
    sparklines: {},
    connectionStatus: 'disconnected',
    selectedTicker: 'AAPL',
  })
})

describe('MainChart', () => {
  it('renders a container div', () => {
    const { container } = render(<MainChart />)
    const chartDiv = container.querySelector('div > div')
    expect(chartDiv).toBeTruthy()
  })

  it('calls createChart with dark theme options', async () => {
    render(<MainChart />)
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
    render(<MainChart />)
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

  it('handles empty sparkline points without crashing', () => {
    usePriceStore.setState({ sparklines: {} })
    expect(() => render(<MainChart />)).not.toThrow()
  })

  it('cleans up chart on unmount', () => {
    const { unmount } = render(<MainChart />)
    unmount()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('creates ResizeObserver and observes the container', () => {
    render(<MainChart />)
    expect(mockObserve).toHaveBeenCalledWith(expect.any(HTMLElement))
  })

  it('disconnects ResizeObserver on unmount', () => {
    const { unmount } = render(<MainChart />)
    unmount()
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('container div has w-full h-full classes', () => {
    const { container } = render(<MainChart />)
    const chartDiv = container.firstChild as HTMLElement
    expect(chartDiv.className).toContain('w-full')
    expect(chartDiv.className).toContain('h-full')
  })
})
