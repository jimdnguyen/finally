import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'

afterEach(() => cleanup())

// Mock ECharts to avoid heavy DOM simulation in tests
vi.mock('echarts-for-react', () => ({
  default: ({ option, style }: any) =>
    React.createElement('div', { 'data-testid': 'echarts-mock', style }),
}))

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
  })),
}))
