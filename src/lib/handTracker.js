import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { handMetrics, extensionFromScale } from './controlMath.js'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
]

export class HandTracker {
  constructor(video, canvas) {
    this.video = video
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.landmarker = null
    this.stream = null
    this.lastVideoTime = -1
    this.lastResult = null
    this.baseline = { left: 0.19, right: 0.19 }
    this.ready = false
    this.loading = false
    this.fps = 0
    this.frames = 0
    this.fpsStamp = performance.now()
  }

  async load() {
    if (this.landmarker || this.loading) return
    this.loading = true
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    })
    this.loading = false
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API is unavailable. Use HTTPS or localhost.')
    await this.load()
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    })
    this.video.srcObject = this.stream
    await this.video.play()
    this.ready = true
    this.resizeOverlay()
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.ready = false
    this.video.srcObject = null
    this.clearOverlay()
  }

  resizeOverlay() {
    const width = this.video.videoWidth || 960
    const height = this.video.videoHeight || 720
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
  }

  detect(now = performance.now()) {
    if (!this.ready || !this.landmarker || this.video.readyState < 2) return null
    if (this.video.currentTime === this.lastVideoTime) return this.lastResult
    this.lastVideoTime = this.video.currentTime
    this.resizeOverlay()
    this.lastResult = this.landmarker.detectForVideo(this.video, now)
    this.draw(this.lastResult)
    this.#measureFps(now)
    return this.lastResult
  }
  #measureFps(now) {
    this.frames += 1
    if (now - this.fpsStamp >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsStamp))
      this.frames = 0
      this.fpsStamp = now
    }
  }

  hands(now = performance.now()) {
    const result = this.detect(now)
    const output = { left: null, right: null }
    if (!result?.landmarks) return output

    result.landmarks.forEach((landmarks, index) => {
      const category = result.handedness?.[index]?.[0]
      const label = (category?.categoryName || category?.displayName || '').toLowerCase()
      const side = label.includes('left') ? 'left' : label.includes('right') ? 'right' : (landmarks[0].x > 0.5 ? 'left' : 'right')
      const metrics = handMetrics(landmarks)
      metrics.extension = extensionFromScale(metrics.scale, this.baseline[side], metrics.fistScore)
      metrics.confidence = category?.score ?? 0
      output[side] = metrics
    })
    return output
  }

  calibrate() {
    const result = this.lastResult
    if (!result?.landmarks?.length) return false
    result.landmarks.forEach((landmarks, index) => {
      const category = result.handedness?.[index]?.[0]
      const label = (category?.categoryName || '').toLowerCase()
      const side = label.includes('left') ? 'left' : label.includes('right') ? 'right' : (landmarks[0].x > 0.5 ? 'left' : 'right')
      const scale = handMetrics(landmarks).scale
      if (scale > 0.03) this.baseline[side] = scale
    })
    return true
  }
  clearOverlay() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  draw(result) {
    this.clearOverlay()
    if (!result?.landmarks) return
    const ctx = this.ctx
    ctx.lineWidth = Math.max(2, this.canvas.width / 420)
    ctx.lineCap = 'round'
    for (const landmarks of result.landmarks) {
      ctx.strokeStyle = 'rgba(120, 231, 255, .92)'
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath()
        ctx.moveTo(landmarks[a].x * this.canvas.width, landmarks[a].y * this.canvas.height)
        ctx.lineTo(landmarks[b].x * this.canvas.width, landmarks[b].y * this.canvas.height)
        ctx.stroke()
      }
      for (const point of landmarks) {
        ctx.fillStyle = 'rgba(255,255,255,.96)'
        ctx.beginPath()
        ctx.arc(point.x * this.canvas.width, point.y * this.canvas.height, Math.max(2.6, this.canvas.width / 260), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
