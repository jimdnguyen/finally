import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import TabStrip from './TabStrip'

const TABS = ['Heatmap', 'Positions', 'P&L History']

describe('TabStrip', () => {
  it('renders all 3 tab labels', () => {
    const { getByText } = render(
      <TabStrip tabs={TABS} activeTab="Positions" onTabChange={() => {}} />
    )
    expect(getByText('Heatmap')).toBeTruthy()
    expect(getByText('Positions')).toBeTruthy()
    expect(getByText('P&L History')).toBeTruthy()
  })

  it('active tab has blue border class', () => {
    const { getByText } = render(
      <TabStrip tabs={TABS} activeTab="Positions" onTabChange={() => {}} />
    )
    const active = getByText('Positions')
    expect(active.className).toContain('border-blue-primary')
    expect(active.className).toContain('text-text-primary')
  })

  it('inactive tabs have muted text class', () => {
    const { getByText } = render(
      <TabStrip tabs={TABS} activeTab="Positions" onTabChange={() => {}} />
    )
    const inactive = getByText('Heatmap')
    expect(inactive.className).toContain('text-text-muted')
    expect(inactive.className).not.toContain('border-blue-primary')
  })

  it('clicking inactive tab calls onTabChange', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <TabStrip tabs={TABS} activeTab="Positions" onTabChange={onChange} />
    )
    fireEvent.click(getByText('Heatmap'))
    expect(onChange).toHaveBeenCalledWith('Heatmap')
  })

  it('container has 30px height', () => {
    const { container } = render(
      <TabStrip tabs={TABS} activeTab="Positions" onTabChange={() => {}} />
    )
    const strip = container.firstElementChild as HTMLElement
    expect(strip.className).toContain('h-[30px]')
  })
})
