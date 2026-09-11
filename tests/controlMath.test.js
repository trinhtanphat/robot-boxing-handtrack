import { describe, expect, it } from 'vitest'
import { aiPunchPulse, clamp, extensionFromScale, handMetrics, handToTarget } from '../src/lib/controlMath.js'

describe('control math', () => {
  it('clamps values into a requested range', () => {
    expect(clamp(-3)).toBe(0)
    expect(clamp(3)).toBe(1)
    expect(clamp(7, 2, 5)).toBe(5)
  })

  it('turns camera depth growth into bounded arm extension', () => {
    expect(extensionFromScale(0.2, 0.2, 1)).toBe(0)
    expect(extensionFromScale(0.3, 0.2, 1)).toBeGreaterThan(0.9)
    expect(extensionFromScale(0.5, 0.2, 1)).toBe(1)
  })

  it('maps tracked hand positions to safe robot target bounds', () => {
    const target = handToTarget({ x: 1, y: 0, extension: 3 })
    expect(target.x).toBeLessThanOrEqual(1.15)
    expect(target.y).toBeLessThanOrEqual(3.62)
    expect(target.z).toBeCloseTo(2.2)
  })

  it('produces a pulse in the 0..1 range', () => {
    for (let t = 0; t < 10; t += 0.17) {
      expect(aiPunchPulse(t)).toBeGreaterThanOrEqual(0)
      expect(aiPunchPulse(t)).toBeLessThanOrEqual(1)
    }
  })

  it('handles missing landmark data', () => {
    expect(handMetrics([])).toEqual({ x: 0.5, y: 0.5, scale: 0, fistScore: 0 })
  })
})
