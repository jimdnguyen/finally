import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import SparklineChart from './SparklineChart'
import type { SparklinePoint } from '@/stores/priceStore'

const mockSetData = vi.fn()
const mockRemove = vi.fn()
const mockAddSeries = vi.fn(() => ({ setData: mockSetData }))

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: mockAddSeries,
    remove: mockRemove,
  })),
  LineSeries: {},
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const makePoints = (n: number): SparklinePoint[] =>
  Array.from({ length: n }, (_, i) => ({ time: 1000 + i, value: 100 + i }))

describe('SparklineChart', () => {
  it('renders a container div', () => {
    const { container } = render(<SparklineChart points={[]} />)
    expect(container.querySelector('div')).toBeTruthy()
  })

  it('renders with default 52x20 dimensions', () => {
    const { container } = render(<SparklineChart points={[]} />)
    const div = container.querySelector('div')!
    expect(div.style.width).toBe('52px')
    expect(div.style.height).toBe('20px')
  })

  it('renders with custom dimensions', () => {
    const { container } = render(<SparklineChart points={[]} width={100} height={40} />)
    const div = container.querySelector('div')!
    expect(div.style.width).toBe('100px')
    expect(div.style.height).toBe('40px')
  })

  it('handles empty points array without calling setData', () => {
    render(<SparklineChart points={[]} />)
    expect(mockSetData).not.toHaveBeenCalled()
  })

  it('calls setData when points are provided', () => {
    const points = makePoints(3)
    render(<SparklineChart points={points} />)
    expect(mockSetData).toHaveBeenCalledWith(points)
  })

  it('calls chart.remove on unmount', () => {
    const { unmount } = render(<SparklineChart points={[]} />)
    unmount()
    expect(mockRemove).toHaveBeenCalled()
  })
})
