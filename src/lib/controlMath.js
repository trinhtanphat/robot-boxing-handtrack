export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export const lerp = (a, b, t) => a + (b - a) * t

export function expSmoothing(previous, next, dt, speed = 12) {
  const t = 1 - Math.exp(-speed * Math.max(0, dt))
  return lerp(previous, next, t)
}

export function distance2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function handMetrics(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return { x: 0.5, y: 0.5, scale: 0, fistScore: 0 }
  }

  const xs = landmarks.map((p) => p.x)
  const ys = landmarks.map((p) => p.y)
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const wrist = landmarks[0]
  const tipPipPairs = [[8, 6], [12, 10], [16, 14], [20, 18]]
  let curled = 0

  for (const [tipIndex, pipIndex] of tipPipPairs) {
    const tipDistance = distance2(landmarks[tipIndex], wrist)
    const pipDistance = distance2(landmarks[pipIndex], wrist)
    curled += tipDistance < pipDistance * 1.08 ? 1 : 0
  }

  const thumbTip = distance2(landmarks[4], landmarks[9])
  const thumbJoint = distance2(landmarks[3], landmarks[9])
  curled += thumbTip < thumbJoint * 1.15 ? 0.75 : 0

  return {
    x: 1 - wrist.x,
    y: wrist.y,
    scale,
    fistScore: clamp(curled / 4.75),
  }
}

export function extensionFromScale(scale, baseline, fistScore) {
  if (!baseline || baseline <= 0) return 0
  const relativeGrowth = scale / baseline - 1
  const depth = clamp(relativeGrowth * 2.7)
  return clamp(depth * (0.35 + 0.65 * clamp(fistScore)))
}

export function handToTarget(hand) {
  if (!hand) return { x: 0, y: 2.65, z: 0.58 }
  return {
    x: clamp((hand.x - 0.5) * 2.25, -1.15, 1.15),
    y: clamp(3.7 - hand.y * 2.2, 1.72, 3.62),
    z: 0.58 + clamp(hand.extension) * 1.62,
  }
}

export function aiPunchPulse(timeSeconds, period = 1.6, offset = 0) {
  const phase = (((timeSeconds + offset) % period) + period) % period / period
  const center = 0.22
  const width = 0.085
  return clamp(Math.exp(-((phase - center) ** 2) / (2 * width ** 2)))
}
