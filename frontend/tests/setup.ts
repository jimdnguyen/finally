import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// Mock ECharts to avoid heavy DOM simulation in tests
vi.mock('echarts-for-react', () => ({
  default: ({ option, style }: any) => (
    <div data-testid="echarts-mock" style={style} />
  ),
}))

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
  })),
}))
