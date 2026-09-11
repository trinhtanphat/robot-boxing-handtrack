import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32],
]

export class BodyTracker {
  constructor(video, canvas) {
    this.video = video
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.landmarker = null
    this.lastVideoTime = -1
    this.lastResult = null
    this.loading = false
    this.delegate = 'off'
    this.lastDetectionAt = -Infinity
    this.minDetectionInterval = 45
  }

  async load() {
    if (this.landmarker) return this.landmarker
    if (this.loading) return null
    this.loading = true
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
      for (const delegate of ['GPU', 'CPU']) {
        try {
          this.landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })
          this.delegate = delegate.toLowerCase()
          return this.landmarker
        } catch (error) {
          if (delegate === 'CPU') throw error
          console.warn('Pose GPU delegate unavailable, falling back to CPU.', error)
        }
      }
      return null
    } finally {
      this.loading = false
    }
  }

  reset() {
    this.lastVideoTime = -1
    this.lastResult = null
    this.lastDetectionAt = -Infinity
  }

  detect(now = performance.now()) {
    if (!this.landmarker || this.video.readyState < 2) return null
    if (this.video.currentTime === this.lastVideoTime) return this.lastResult
    if (now - this.lastDetectionAt < this.minDetectionInterval) return this.lastResult
    this.lastVideoTime = this.video.currentTime
    this.lastDetectionAt = now
    this.lastResult = this.landmarker.detectForVideo(this.video, now)
    return this.lastResult
  }

  pose(now = performance.now()) {
    const result = this.detect(now)
    const landmarks = result?.landmarks?.[0]
    if (!landmarks) return null
    return {
      landmarks,
      leftShoulder: landmarks[11], rightShoulder: landmarks[12],
      leftElbow: landmarks[13], rightElbow: landmarks[14],
      leftWrist: landmarks[15], rightWrist: landmarks[16],
      leftHip: landmarks[23], rightHip: landmarks[24],
      leftKnee: landmarks[25], rightKnee: landmarks[26],
      leftAnkle: landmarks[27], rightAnkle: landmarks[28],
    }
  }

  draw(result = this.lastResult, color = 'rgba(255, 204, 92, .82)') {
    const landmarks = result?.landmarks?.[0]
    if (!landmarks) return
    const { ctx, canvas } = this
    ctx.save()
    ctx.lineWidth = Math.max(2, canvas.width / 520)
    ctx.lineCap = 'round'
    ctx.strokeStyle = color
    for (const [a, b] of CONNECTIONS) {
      ctx.beginPath()
      ctx.moveTo(landmarks[a].x * canvas.width, landmarks[a].y * canvas.height)
      ctx.lineTo(landmarks[b].x * canvas.width, landmarks[b].y * canvas.height)
      ctx.stroke()
    }
    ctx.restore()
  }
}
