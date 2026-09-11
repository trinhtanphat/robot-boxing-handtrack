import * as THREE from 'three'
import { clamp } from './controlMath.js'

const up = new THREE.Vector3(0, 1, 0)
const vec = (x, y, z) => new THREE.Vector3(x, y, z)

function segment(radius, material, radial = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, 1, radial), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function placeSegment(mesh, a, b) {
  if (!mesh) return
  const direction = b.clone().sub(a)
  const length = Math.max(direction.length(), 0.001)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.set(1, length, 1)
  mesh.quaternion.setFromUnitVectors(up, direction.normalize())
}

const presets = {
  atlas: {
    name: 'ATLAS', main: 0x176db7, secondary: 0xd7e0e7, dark: 0x17212b,
    glow: 0x45d8ff, trim: 0x89a9bd, glove: 0x1260a8, scale: 0.96,
    shoulder: 0.2, upper: 0.105, fore: 0.105, gloveSize: 0.24,
  },
  brutus: {
    name: 'BRUTUS', main: 0xa52b27, secondary: 0x4a4d50, dark: 0x191b1e,
    glow: 0xff4e32, trim: 0x7c6b5c, glove: 0x9d2725, scale: 1.08,
    shoulder: 0.24, upper: 0.13, fore: 0.14, gloveSize: 0.285,
  },
}

export class RobotBoxer {
  constructor({ style = 'atlas', color, accent, z = 1.3, facing = -1 } = {}) {
    this.config = { ...(presets[style] || presets.atlas) }
    if (color !== undefined) this.config.main = color
    if (accent !== undefined) this.config.glow = accent
    this.style = style
    this.group = new THREE.Group()
    this.group.name = this.config.name
    this.group.position.z = z
    this.group.rotation.y = facing < 0 ? Math.PI : 0
    this.group.scale.setScalar(this.config.scale)
    this.facing = facing
    this.bodyX = 0
    this.bodyLean = 0
    this.bodyCrouch = 0
    this.visual = null
    this.visualParts = null
    this.visualAnimations = []
    this.mixer = null
    this.extension = { left: 0, right: 0 }
    this.material = new THREE.MeshStandardMaterial({ color: this.config.main, emissive: 0x000000, metalness: 0.82, roughness: 0.23 })
    this.secondary = new THREE.MeshStandardMaterial({ color: this.config.secondary, metalness: 0.76, roughness: 0.27 })
    this.dark = new THREE.MeshStandardMaterial({ color: this.config.dark, metalness: 0.88, roughness: 0.2 })
    this.trim = new THREE.MeshStandardMaterial({ color: this.config.trim, metalness: 0.92, roughness: 0.19 })
    this.gloveMat = new THREE.MeshStandardMaterial({ color: this.config.glove, metalness: 0.42, roughness: 0.38 })
    this.glow = new THREE.MeshStandardMaterial({ color: this.config.glow, emissive: this.config.glow, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.22 })
    this.#body()
    this.arms = { left: this.#arm(-1), right: this.#arm(1) }
    this.pose = { left: vec(-0.58, 1.85, 0.44), right: vec(0.58, 1.85, 0.44) }
    this.setPose(this.pose)
  }

  #mesh(geometry, material = this.material, parent = this.group) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  #body() {
    const heavy = this.style === 'brutus'
    const hips = this.#mesh(new THREE.BoxGeometry(heavy ? 0.94 : 0.78, 0.35, 0.48), this.dark)
    hips.position.y = 0.79
    const abdomen = this.#mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.52, 8), this.trim)
    abdomen.position.y = 1.12
    const torso = this.#mesh(new THREE.BoxGeometry(heavy ? 1.24 : 1.02, heavy ? 0.92 : 0.86, heavy ? 0.66 : 0.55), this.material)
    torso.position.y = 1.55
    const chest = this.#mesh(new THREE.BoxGeometry(heavy ? 0.9 : 0.72, 0.2, heavy ? 0.7 : 0.59), this.secondary)
    chest.position.set(0, 1.71, 0.06)
    const chestCore = this.#mesh(new THREE.BoxGeometry(heavy ? 0.46 : 0.34, 0.09, 0.71), this.glow)
    chestCore.position.set(0, 1.72, 0.085)
    for (const side of [-1, 1]) {
      const rib = this.#mesh(new THREE.BoxGeometry(heavy ? 0.24 : 0.18, 0.53, 0.62), this.secondary)
      rib.position.set(side * (heavy ? 0.5 : 0.41), 1.58, 0)
      rib.rotation.z = side * (heavy ? 0.08 : 0.13)
    }
    const neck = this.#mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.19, 16), this.dark)
    neck.position.y = 2.09
    const head = this.#mesh(new THREE.BoxGeometry(heavy ? 0.54 : 0.47, heavy ? 0.45 : 0.42, 0.5), this.dark)
    head.position.y = 2.38
    const forehead = this.#mesh(new THREE.BoxGeometry(heavy ? 0.58 : 0.48, 0.12, 0.43), this.material)
    forehead.position.set(0, 2.52, -0.01)
    const visor = this.#mesh(new THREE.BoxGeometry(heavy ? 0.42 : 0.34, 0.075, 0.515), this.glow)
    visor.position.set(0, 2.41, 0.035)
    if (heavy) {
      for (const side of [-1, 1]) {
        const tank = this.#mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.58, 10), this.trim)
        tank.position.set(side * 0.38, 1.47, -0.36)
      }
    }
    for (const side of [-1, 1]) {
      const thigh = segment(heavy ? 0.155 : 0.125, this.dark)
      const thighArmor = segment(heavy ? 0.19 : 0.15, this.material)
      const shin = segment(heavy ? 0.14 : 0.105, this.trim)
      const knee = this.#mesh(new THREE.SphereGeometry(heavy ? 0.17 : 0.14, 16, 12), this.secondary)
      const foot = this.#mesh(new THREE.BoxGeometry(heavy ? 0.42 : 0.34, 0.15, heavy ? 0.58 : 0.48), this.dark)
      this.group.add(thigh, thighArmor, shin)
      const hip = vec(side * (heavy ? 0.31 : 0.25), 0.76, 0)
      const kneePos = vec(side * (heavy ? 0.34 : 0.28), 0.39, side * 0.025)
      const ankle = vec(side * (heavy ? 0.36 : 0.3), 0.09, side * 0.08)
      placeSegment(thigh, hip, kneePos)
      placeSegment(thighArmor, hip.clone().lerp(kneePos, 0.18), hip.clone().lerp(kneePos, 0.72))
      placeSegment(shin, kneePos, ankle)
      knee.position.copy(kneePos)
      foot.position.set(ankle.x, 0.05, ankle.z + 0.1)
    }
  }

  #arm(sideSign) {
    const heavy = this.style === 'brutus'
    const shoulder = this.#mesh(new THREE.SphereGeometry(this.config.shoulder, 18, 14), this.dark)
    const shoulderArmor = this.#mesh(new THREE.BoxGeometry(heavy ? 0.42 : 0.34, heavy ? 0.33 : 0.26, heavy ? 0.48 : 0.38), this.material)
    const elbow = this.#mesh(new THREE.SphereGeometry(heavy ? 0.16 : 0.14, 16, 12), this.dark)
    const glove = this.#mesh(new THREE.IcosahedronGeometry(this.config.gloveSize, 2), this.gloveMat)
    const knuckle = this.#mesh(new THREE.BoxGeometry(heavy ? 0.29 : 0.24, heavy ? 0.12 : 0.1, heavy ? 0.31 : 0.25), this.secondary)
    const upper = segment(this.config.upper, this.trim)
    const upperArmor = segment(this.config.upper * 1.28, this.material)
    const fore = segment(this.config.fore, this.dark)
    const foreArmor = segment(this.config.fore * 1.33, this.secondary)
    this.group.add(upper, upperArmor, fore, foreArmor)
    const shoulderPos = vec(sideSign * (heavy ? 0.73 : 0.65), 1.87, 0)
    shoulder.position.copy(shoulderPos)
    shoulderArmor.position.copy(shoulderPos).add(vec(sideSign * 0.08, 0.03, 0))
    return { sideSign, shoulder, shoulderArmor, shoulderPos, elbow, glove, knuckle, upper, upperArmor, fore, foreArmor }
  }

  #syncVisualArm(side, shoulder, elbow, target) {
    const parts = this.visualParts?.[side]
    if (!parts) return
    placeSegment(parts.upper, shoulder, elbow)
    placeSegment(parts.lower, elbow, target)
    parts.elbow?.position.copy(elbow)
    parts.glove?.position.copy(target)
  }

  #setArm(side, target) {
    const arm = this.arms[side]
    const shoulder = arm.shoulderPos
    const limited = target.clone()
    limited.x = clamp(limited.x, -1.2, 1.2)
    limited.y = clamp(limited.y, 1.15, 2.62)
    limited.z = clamp(limited.z, 0.18, 1.88)
    const elbow = shoulder.clone().lerp(limited, 0.5)
    elbow.x += arm.sideSign * (this.style === 'brutus' ? 0.15 : 0.12)
    elbow.y += 0.08
    elbow.z -= 0.08
    placeSegment(arm.upper, shoulder, elbow)
    placeSegment(arm.upperArmor, shoulder.clone().lerp(elbow, 0.12), shoulder.clone().lerp(elbow, 0.72))
    placeSegment(arm.fore, elbow, limited)
    placeSegment(arm.foreArmor, elbow.clone().lerp(limited, 0.18), elbow.clone().lerp(limited, 0.8))
    arm.elbow.position.copy(elbow)
    arm.glove.position.copy(limited)
    arm.knuckle.position.copy(limited).add(vec(0, 0.03, 0.12))
    this.#syncVisualArm(side, shoulder, elbow, limited)
  }

  setPose({ left, right }) {
    if (left) this.pose.left.copy(left)
    if (right) this.pose.right.copy(right)
    this.#setArm('left', this.pose.left)
    this.#setArm('right', this.pose.right)
  }

  useVisualModel(scene, animations = []) {
    if (!scene) return []
    for (const child of [...this.group.children]) child.visible = false
    this.visual = scene
    this.visual.name = `${this.config.name}_GLB`
    this.visual.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    this.group.add(this.visual)
    this.visualAnimations = animations
    this.visualParts = {
      left: {
        upper: scene.getObjectByName('UpperArm_L'), lower: scene.getObjectByName('LowerArm_L'),
        elbow: scene.getObjectByName('Elbow_L'), glove: scene.getObjectByName('Glove_L'),
      },
      right: {
        upper: scene.getObjectByName('UpperArm_R'), lower: scene.getObjectByName('LowerArm_R'),
        elbow: scene.getObjectByName('Elbow_R'), glove: scene.getObjectByName('Glove_R'),
      },
    }
    this.mixer = new THREE.AnimationMixer(this.visual)
    this.setPose(this.pose)
    return animations.map((clip) => clip.name)
  }

  playAnimation(name, { loop = THREE.LoopOnce } = {}) {
    if (!this.mixer) return false
    const clip = THREE.AnimationClip.findByName(this.visualAnimations, name)
    if (!clip) return false
    this.mixer.stopAllAction()
    const action = this.mixer.clipAction(clip)
    action.reset().setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity).play()
    action.clampWhenFinished = true
    return true
  }

  setBodyMotion({ lean = 0, crouch = 0 } = {}) {
    this.bodyLean = clamp(lean, -1.2, 1.2)
    this.bodyCrouch = clamp(crouch, 0, 1)
  }

  update(dt, time = 0) {
    this.group.position.x += (this.bodyX - this.group.position.x) * Math.min(1, dt * 8)
    const bounce = Math.sin(time * (this.style === 'brutus' ? 4.1 : 5.4)) * (this.style === 'brutus' ? 0.008 : 0.014)
    const crouchTarget = -this.bodyCrouch * (this.style === 'brutus' ? 0.16 : 0.22)
    this.group.position.y += ((bounce + crouchTarget) - this.group.position.y) * Math.min(1, dt * 10)
    const leanTarget = -this.bodyLean * (this.style === 'brutus' ? 0.12 : 0.2)
    this.group.rotation.z += (leanTarget - this.group.rotation.z) * Math.min(1, dt * 9)
    this.mixer?.update(dt)
  }

  setBodyX(x) {
    this.bodyX = clamp(x, -1.55, 1.55)
  }

  getGloveWorld(side) {
    return this.arms[side].glove.getWorldPosition(new THREE.Vector3())
  }

  getChestWorld() {
    return this.group.localToWorld(vec(0, 1.62, 0.08))
  }

  guardScore() {
    const chest = vec(0, 1.75, 0.2)
    const left = this.pose.left.distanceTo(chest)
    const right = this.pose.right.distanceTo(chest)
    return clamp(1 - Math.min(left, right) / 1.15)
  }

  flashHit(amount = 1) {
    const glowInitial = this.glow.emissiveIntensity
    const emissiveInitial = this.material.emissive.getHex()
    this.glow.emissiveIntensity = 4 + amount * 0.08
    this.material.emissive.set(this.config.glow)
    this.material.emissiveIntensity = 0.35
    const visualMaterials = new Set()
    this.visual?.traverse((object) => {
      if (object.isMesh && object.material?.emissive) {
        visualMaterials.add(object.material)
        object.material.userData.previousEmissive = object.material.emissive.getHex()
        object.material.emissive.set(this.config.glow)
        object.material.emissiveIntensity = Math.max(object.material.emissiveIntensity || 0, 0.45)
      }
    })
    clearTimeout(this.flashTimer)
    this.flashTimer = setTimeout(() => {
      this.glow.emissiveIntensity = glowInitial
      this.material.emissive.setHex(emissiveInitial)
      this.material.emissiveIntensity = 1
      for (const mat of visualMaterials) {
        mat.emissive.setHex(mat.userData.previousEmissive ?? 0)
        mat.emissiveIntensity = mat.name?.includes('Glow') ? 1.6 : 0
      }
    }, 120)
  }
}
