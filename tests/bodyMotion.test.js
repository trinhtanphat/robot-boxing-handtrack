import { describe, expect, it } from 'vitest'
import { bodyMetrics, bodyToRobotMotion, poseBaseline } from '../src/lib/bodyMotion.js'

function pose({ shift = 0, lean = 0, crouch = 0 } = {}) {
  const hipY = 0.62 + crouch
  return {
    leftShoulder: { x: 0.4 + shift + lean, y: 0.35 },
    rightShoulder: { x: 0.6 + shift + lean, y: 0.35 },
    leftHip: { x: 0.43 + shift, y: hipY },
    rightHip: { x: 0.57 + shift, y: hipY },
  }
}

describe('body motion mapping', () => {
  it('maps hip translation to lateral movement', () => {
    const basePose = pose()
    const base = poseBaseline(basePose)
    const moved = bodyMetrics(pose({ shift: 0.1 }), base)
    expect(moved.lateral).toBeLessThan(-0.4)
  })

  it('maps shoulder offset to lean and hip drop to crouch', () => {
    const base = poseBaseline(pose())
    const moved = bodyMetrics(pose({ lean: 0.08, crouch: 0.08 }), base)
    expect(moved.lean).toBeLessThan(-0.3)
    expect(moved.crouch).toBeGreaterThan(0.2)
  })

  it('converts body metrics to bounded robot motion', () => {
    const motion = bodyToRobotMotion({ lateral: 3, lean: -2, crouch: 2 })
    expect(motion).toEqual({ x: 1.45, lean: -1, crouch: 1 })
  })

  it('returns a neutral robot pose when body tracking is unavailable', () => {
    expect(bodyToRobotMotion(null)).toEqual({ x: 0, lean: 0, crouch: 0 })
  })
})
