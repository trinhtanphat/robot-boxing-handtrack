import { clamp } from './controlMath.js'

const avg = (a, b) => ({ x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, z: (a.z + b.z) * 0.5 })

export function bodyMetrics(pose, baseline = null) {
  if (!pose) return null
  const shoulder = avg(pose.leftShoulder, pose.rightShoulder)
  const hip = avg(pose.leftHip, pose.rightHip)
  const shoulderWidth = Math.max(0.001, Math.abs(pose.leftShoulder.x - pose.rightShoulder.x))
  const torsoHeight = Math.max(0.001, Math.abs(hip.y - shoulder.y))
  const neutral = baseline || { centerX: hip.x, shoulderWidth, torsoHeight, hipY: hip.y }
  const scale = Math.max(neutral.shoulderWidth, 0.08)
  const lateral = clamp((neutral.centerX - hip.x) / scale, -1.4, 1.4)
  const lean = clamp((hip.x - shoulder.x) / scale, -1.15, 1.15)
  const crouch = clamp((hip.y - neutral.hipY) / Math.max(neutral.torsoHeight, 0.08), -0.2, 1.0)
  return { shoulder, hip, shoulderWidth, torsoHeight, lateral, lean, crouch }
}

export function poseBaseline(pose) {
  if (!pose) return null
  const shoulder = avg(pose.leftShoulder, pose.rightShoulder)
  const hip = avg(pose.leftHip, pose.rightHip)
  return {
    centerX: hip.x,
    hipY: hip.y,
    shoulderWidth: Math.max(0.08, Math.abs(pose.leftShoulder.x - pose.rightShoulder.x)),
    torsoHeight: Math.max(0.08, Math.abs(hip.y - shoulder.y)),
  }
}
