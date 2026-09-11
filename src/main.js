import * as THREE from 'three'
import './style.css'
import { Arena } from './lib/arena.js'
import { RobotBoxer } from './lib/robot.js'
import { HandTracker } from './lib/handTracker.js'
import { BodyTracker } from './lib/bodyTracker.js'
import { MatchGame } from './lib/game.js'
import { loadFighterAssets } from './lib/modelAssets.js'
import { aiPunchPulse, clamp, handToTarget } from './lib/controlMath.js'
import { bodyMetrics, bodyToRobotMotion, poseBaseline } from './lib/bodyMotion.js'

const $ = (selector) => document.querySelector(selector)
const ui = {
  stage: $('#stage'), cameraBtn: $('#cameraBtn'), matchBtn: $('#matchBtn'), calibrateBtn: $('#calibrateBtn'), resetBtn: $('#resetBtn'),
  mode: $('#modeSelect'), video: $('#webcam'), overlay: $('#handOverlay'), placeholder: $('#cameraPlaceholder'), fps: $('#cameraFps'),
  p1Text: $('#p1HpText'), p2Text: $('#p2HpText'), p1Health: $('#p1Health'), p2Health: $('#p2Health'), timer: $('#timerText'),
  leftState: $('#leftHandState'), rightState: $('#rightHandState'), bodyState: $('#bodyState'),
  trackerState: $('#trackerState'), matchState: $('#matchState'), engineStatus: $('#engineStatus'), toast: $('#toast'),
}

const arena = new Arena(ui.stage)
const p1 = new RobotBoxer({ style: 'atlas', z: 1.32, facing: -1 })
const p2 = new RobotBoxer({ style: 'brutus', z: -1.32, facing: 1 })
arena.scene.add(p1.group, p2.group)

let modelStatus = 'loading GLB'
loadFighterAssets(p1, p2).then((results) => {
  const loaded = results.filter((result) => result.ok)
  modelStatus = loaded.length === 2 ? 'GLB fighters ready' : `${loaded.length}/2 GLB · fallback active`
  for (const result of results) {
    if (!result.ok) console.warn(`Could not load ${result.style} GLB; procedural fallback remains active.`, result.error)
  }
}).catch((error) => {
  console.warn('GLB fighter loading failed; procedural fallback remains active.', error)
  modelStatus = 'procedural fallback'
})

document.querySelector('.fighter-blue span').textContent = 'ATLAS · CAMERA'
document.querySelector('.fighter-orange span').textContent = 'BRUTUS · AI'

const tracker = new HandTracker(ui.video, ui.overlay)
const bodyTracker = new BodyTracker(ui.video, ui.overlay)
const game = new MatchGame()
const keys = new Set()
const punchAt = { p1Left: -Infinity, p1Right: -Infinity, p2Left: -Infinity, p2Right: -Infinity }
const extensions = { p1Left: 0, p1Right: 0, p2Left: 0, p2Right: 0 }
const targets = {
  p1Left: new THREE.Vector3(-0.56, 1.82, 0.5), p1Right: new THREE.Vector3(0.56, 1.82, 0.5),
  p2Left: new THREE.Vector3(-0.56, 1.82, 0.5), p2Right: new THREE.Vector3(0.56, 1.82, 0.5),
}
let previousTime = performance.now()
let p1X = 0
let p2X = 0
let lastToastTimer = 0
let bodyBaseline = null
let bodyVisible = false
let atlasBody = { x: 0, lean: 0, crouch: 0 }

function guardTarget(side, extension = 0) {
  return new THREE.Vector3(side === 'left' ? -0.56 : 0.56, 1.82, 0.5 + extension * 1.23)
}

function pulse(stamp, now) {
  const age = now - stamp
  if (age < 0 || age > 520) return 0
  const t = age / 520
  return Math.sin(Math.PI * t) ** 1.7
}

function toast(message) {
  ui.toast.textContent = message
  ui.toast.classList.add('show')
  clearTimeout(lastToastTimer)
  lastToastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400)
}

function handLabel(hand) {
  if (!hand) return 'not seen'
  if (hand.fistScore > 0.7 && hand.extension > 0.55) return 'punching'
  if (hand.fistScore > 0.62) return 'fist'
  return 'open'
}

function cameraTarget(hand, side) {
  if (!hand) return guardTarget(side)
  const mapped = handToTarget(hand)
  mapped.x = side === 'left' ? Math.min(mapped.x, 0.15) : Math.max(mapped.x, -0.15)
  return new THREE.Vector3(mapped.x, mapped.y, mapped.z)
}

function setPunchStamp(code, now) {
  if (code === 'KeyF') punchAt.p1Left = now
  if (code === 'KeyG') punchAt.p1Right = now
  if (code === 'KeyN') punchAt.p2Left = now
  if (code === 'KeyM') punchAt.p2Right = now
}

function trackerLabel() {
  if (!tracker.ready) return 'offline'
  const hand = `hands ${tracker.delegate}`
  return bodyTracker.landmarker ? `${hand} · body ${bodyTracker.delegate}` : hand
}

window.addEventListener('keydown', (event) => {
  if (!event.repeat) setPunchStamp(event.code, performance.now())
  keys.add(event.code)
})
window.addEventListener('keyup', (event) => keys.delete(event.code))

ui.cameraBtn.addEventListener('click', async () => {
  ui.cameraBtn.disabled = true
  ui.trackerState.textContent = 'loading model…'
  try {
    if (tracker.ready) {
      tracker.stop()
      bodyTracker.reset()
      bodyBaseline = null
      bodyVisible = false
      atlasBody = { x: 0, lean: 0, crouch: 0 }
      ui.placeholder.hidden = false
      ui.cameraBtn.textContent = 'Enable camera'
      ui.trackerState.textContent = 'offline'
      ui.bodyState.textContent = 'waiting'
      toast('Camera stopped')
    } else {
      await tracker.start()
      ui.placeholder.hidden = true
      ui.cameraBtn.textContent = 'Disable camera'
      ui.trackerState.textContent = `hands ${tracker.delegate} · loading body…`
      try {
        await bodyTracker.load()
      } catch (bodyError) {
        console.warn('Body tracking unavailable; hand tracking will continue.', bodyError)
      }
      ui.trackerState.textContent = trackerLabel()
      toast(bodyTracker.landmarker ? 'Camera ready · hands + body tracking active' : 'Camera ready · hand tracking active')
    }
  } catch (error) {
    console.error(error)
    tracker.stop()
    bodyTracker.reset()
    ui.placeholder.hidden = false
    ui.trackerState.textContent = 'camera error'
    toast(error?.message || 'Could not start camera')
  } finally {
    ui.cameraBtn.disabled = false
  }
})

ui.calibrateBtn.addEventListener('click', () => {
  if (!tracker.ready) return toast('Enable the camera first')
  const handOk = tracker.calibrate()
  const pose = bodyTracker.landmarker ? bodyTracker.pose(performance.now()) : null
  const nextBaseline = poseBaseline(pose)
  if (nextBaseline) bodyBaseline = nextBaseline
  const bodyOk = Boolean(nextBaseline)
  if (handOk && bodyOk) toast('Guard + body center calibrated')
  else if (handOk) toast('Guard depth calibrated · step fully into frame for body calibration')
  else if (bodyOk) toast('Body center calibrated · show a hand to calibrate guard depth')
  else toast('Show your hands and upper body, then calibrate')
})

ui.matchBtn.addEventListener('click', () => {
  p1.stopAnimation?.()
  p2.stopAnimation?.()
  game.start()
  toast('Steel Champions round started')
})

ui.resetBtn.addEventListener('click', () => {
  game.reset()
  p1.stopAnimation?.()
  p2.stopAnimation?.()
  p1X = p2X = 0
  p1.setBodyX(0)
  p2.setBodyX(0)
  toast('Match reset')
})

ui.mode.addEventListener('change', () => {
  const local = ui.mode.value === 'local'
  document.querySelector('.fighter-orange span').textContent = local ? 'BRUTUS · LOCAL' : 'BRUTUS · AI'
  toast(local ? 'Local 2-player mode' : 'Camera vs AI mode')
})

function updateBodyTracking(now, dt) {
  const pose = tracker.ready && bodyTracker.landmarker ? bodyTracker.pose(now) : null
  bodyVisible = Boolean(pose)
  const smoothing = Math.min(1, dt * 9)

  if (pose) {
    if (!bodyBaseline) bodyBaseline = poseBaseline(pose)
    const motion = bodyToRobotMotion(bodyMetrics(pose, bodyBaseline))
    atlasBody.x += (motion.x - atlasBody.x) * smoothing
    atlasBody.lean += (motion.lean - atlasBody.lean) * smoothing
    atlasBody.crouch += (motion.crouch - atlasBody.crouch) * smoothing
    bodyTracker.draw()
  } else {
    atlasBody.lean += (0 - atlasBody.lean) * Math.min(1, dt * 5)
    atlasBody.crouch += (0 - atlasBody.crouch) * Math.min(1, dt * 5)
  }

  ui.bodyState.textContent = !tracker.ready
    ? 'waiting'
    : bodyTracker.landmarker
      ? (bodyVisible ? 'tracking' : 'not seen')
      : 'unavailable'
}

function updatePlayerOne(now, dt) {
  const hands = tracker.ready ? tracker.hands(now) : { left: null, right: null }
  updateBodyTracking(now, dt)

  const fallbackLeft = pulse(punchAt.p1Left, now)
  const fallbackRight = pulse(punchAt.p1Right, now)
  const leftTarget = hands.left ? cameraTarget(hands.left, 'left') : guardTarget('left', fallbackLeft)
  const rightTarget = hands.right ? cameraTarget(hands.right, 'right') : guardTarget('right', fallbackRight)
  if (fallbackLeft > (hands.left?.extension || 0)) leftTarget.z = 0.5 + fallbackLeft * 1.23
  if (fallbackRight > (hands.right?.extension || 0)) rightTarget.z = 0.5 + fallbackRight * 1.23

  const speed = Math.min(1, dt * 13)
  targets.p1Left.lerp(leftTarget, speed)
  targets.p1Right.lerp(rightTarget, speed)
  p1.setPose({ left: targets.p1Left, right: targets.p1Right })

  extensions.p1Left = Math.max(hands.left?.extension || 0, fallbackLeft)
  extensions.p1Right = Math.max(hands.right?.extension || 0, fallbackRight)
  ui.leftState.textContent = handLabel(hands.left)
  ui.rightState.textContent = handLabel(hands.right)
  ui.fps.textContent = `${tracker.fps} fps`

  const keyboardMove = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
  if (keyboardMove !== 0) {
    p1X = clamp(p1X + keyboardMove * dt * 1.8, -1.45, 1.45)
  } else if (bodyVisible) {
    p1X += (atlasBody.x - p1X) * Math.min(1, dt * 8)
  }
  p1.setBodyX(p1X)
}

function updatePlayerTwo(now, dt) {
  let leftPunch = 0
  let rightPunch = 0
  if (ui.mode.value === 'ai') {
    const t = now / 1000
    leftPunch = aiPunchPulse(t, 1.9, 0)
    rightPunch = aiPunchPulse(t, 1.9, 0.95)
    p2X = Math.sin(t * 0.62) * 0.66
  } else {
    leftPunch = pulse(punchAt.p2Left, now)
    rightPunch = pulse(punchAt.p2Right, now)
    const move = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)
    p2X = clamp(p2X + move * dt * 1.8, -1.45, 1.45)
  }

  const leftTarget = guardTarget('left', leftPunch)
  const rightTarget = guardTarget('right', rightPunch)
  const speed = Math.min(1, dt * 11)
  targets.p2Left.lerp(leftTarget, speed)
  targets.p2Right.lerp(rightTarget, speed)
  p2.setPose({ left: targets.p2Left, right: targets.p2Right })
  p2.setBodyX(p2X)
  extensions.p2Left = leftPunch
  extensions.p2Right = rightPunch
}

function resolvePunch(attacker, attackerRobot, defenderRobot, side, extension, previous, dt, now) {
  const glove = attackerRobot.getGloveWorld(side)
  const chest = defenderRobot.getChestWorld()
  const distance = glove.distanceTo(chest)
  const speed = Math.max(0, extension - previous) / Math.max(dt, 0.001)
  const damage = game.resolveHit({ attacker, side, distance, extension, speed, guard: defenderRobot.guardScore(), now })
  if (damage > 0) {
    defenderRobot.flashHit(damage)
    arena.impact(glove, attacker === 0 ? 0x45d8ff : 0xff4e32)
    toast(`${attacker === 0 ? 'ATLAS' : 'BRUTUS'} hit · ${damage.toFixed(1)} damage`)
  }
}

let lastGameState = game.state

function updateUi() {
  ui.p1Text.textContent = Math.ceil(game.health[0])
  ui.p2Text.textContent = Math.ceil(game.health[1])
  ui.p1Health.style.width = `${game.health[0]}%`
  ui.p2Health.style.width = `${game.health[1]}%`
  ui.timer.textContent = game.time.toFixed(1)
  ui.matchState.textContent = game.state
  ui.matchBtn.textContent = game.state === 'fighting' ? 'Round active' : (game.state === 'finished' ? 'Fight again' : 'Start round')
  ui.engineStatus.textContent = tracker.ready
    ? (bodyVisible ? `hands + body live · ${modelStatus}` : `vision active · ${tracker.delegate} · ${modelStatus}`)
    : modelStatus

  if (game.state !== lastGameState && game.state === 'finished') {
    const winnerRobot = game.winner === 0 ? p1 : game.winner === 1 ? p2 : null
    winnerRobot?.playAnimation?.('Victory')
    const result = game.winner === null ? 'Draw' : `${game.winner === 0 ? 'ATLAS' : 'BRUTUS'} wins`
    toast(`Round over · ${result}`)
  }
  lastGameState = game.state
}

function animate(now) {
  requestAnimationFrame(animate)
  const dt = Math.min((now - previousTime) / 1000, 0.05)
  previousTime = now
  const previousExtensions = { ...extensions }

  updatePlayerOne(now, dt)
  updatePlayerTwo(now, dt)
  resolvePunch(0, p1, p2, 'left', extensions.p1Left, previousExtensions.p1Left, dt, now)
  resolvePunch(0, p1, p2, 'right', extensions.p1Right, previousExtensions.p1Right, dt, now)
  resolvePunch(1, p2, p1, 'left', extensions.p2Left, previousExtensions.p2Left, dt, now)
  resolvePunch(1, p2, p1, 'right', extensions.p2Right, previousExtensions.p2Right, dt, now)

  game.update(dt)
  p1.update(dt, now / 1000)
  p2.update(dt, now / 1000 + 0.4)

  p1.group.position.y -= atlasBody.crouch * 0.16
  p1.group.rotation.z = -atlasBody.lean * 0.12

  updateUi()
  arena.render()
}

window.addEventListener('pagehide', () => tracker.stop())

updateUi()
requestAnimationFrame(animate)
