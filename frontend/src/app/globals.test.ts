import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf-8')

describe('globals.css flash animations', () => {
  it('defines .flash-green class with 500ms animation', () => {
    expect(css).toContain('.flash-green')
    expect(css).toMatch(/flash-green\s+500ms/)
  })

  it('defines .flash-red class with 500ms animation', () => {
    expect(css).toContain('.flash-red')
    expect(css).toMatch(/flash-red\s+500ms/)
  })

  it('defines @keyframes flash-green', () => {
    expect(css).toContain('@keyframes flash-green')
  })

  it('defines @keyframes flash-red', () => {
    expect(css).toContain('@keyframes flash-red')
  })
})
