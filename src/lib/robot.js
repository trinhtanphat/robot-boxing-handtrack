import * as THREE from 'three'
import { clamp } from './controlMath.js'

const up = new THREE.Vector3(0, 1, 0)
const vec = (x, y, z) => new THREE.Vector3(x, y, z)

function segment(radius, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, 1, 16), material)
  mesh.castShadow = true
  return mesh
}

function placeSegment(mesh, a, b) {
  const direction = b.clone().sub(a)
  const length = Math.max(direction.length(), 0.001)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.set(1, length, 1)
  mesh.quaternion.setFromUnitVectors(up, direction.normalize())
}

export class RobotBoxer {
  constructor({ color = 0x3d8fd1, accent = 0xb9e4ff, z = 1.3, facing = -1 } = {}) {
    this.group = new THREE.Group()
    this.group.position.z = z
    this.group.rotation.y = facing < 0 ? Math.PI : 0
    this.facing = facing
    this.bodyX = 0
    this.extension = { left: 0, right: 0 }
    this.material = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.26 })
    this.dark = new THREE.MeshStandardMaterial({ color: 0x22272d, metalness: 0.85, roughness: 0.24 })
    this.glow = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7, metalness: 0.35, roughness: 0.3 });
    this.#body()
    this.arms = { left: this.#arm(-1), right: this.#arm(1) }
    this.pose = {
      left: vec(-0.58, 1.85, 0.44),
      right: vec(0.58, 1.85, 0.44),
    }
    this.setPose(this.pose)
  }

  #mesh(geometry, material = this.material) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
    return mesh
  }

  #body() {
    const hips = this.#mesh(new THREE.BoxGeometry(0.78, 0.38, 0.42), this.dark)
    hips.position.y = 0.78
    const torso = this.#mesh(new THREE.BoxGeometry(1.05, 1.05, 0.56))
    torso.position.y = 1.48
    const chest = this.#mesh(new THREE.BoxGeometry(0.45, 0.17, 0.6), this.glow)
    chest.position.set(0, 1.62, 0.04)
    const neck = this.#mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16), this.dark)
    neck.position.y = 2.08
    const head = this.#mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), this.dark)
    head.position.y = 2.37
    const visor = this.#mesh(new THREE.BoxGeometry(0.32, 0.09, 0.5), this.glow)
    visor.position.set(0, 2.4, 0.04)

    for (const side of [-1, 1]) {
      const thigh = segment(0.12, this.dark)
      const shin = segment(0.1, this.material)
      this.group.add(thigh, shin)
      placeSegment(thigh, vec(side * 0.24, 0.72, 0), vec(side * 0.27, 0.34, side * 0.03))
      placeSegment(shin, vec(side * 0.27, 0.34, side * 0.03), vec(side * 0.3, 0.04, side * 0.1))
    }
  }  #arm(sideSign) {
    const shoulder = this.#mesh(new THREE.SphereGeometry(0.18, 18, 14), this.dark)
    const elbow = this.#mesh(new THREE.SphereGeometry(0.14, 16, 12), this.dark)
    const glove = this.#mesh(new THREE.IcosahedronGeometry(0.23, 1), this.material)
    const upper = segment(0.11, this.material)
    const fore = segment(0.1, this.dark)
    this.group.add(upper, fore)
    const shoulderPos = vec(sideSign * 0.66, 1.86, 0)
    shoulder.position.copy(shoulderPos)
    return { sideSign, shoulder, shoulderPos, elbow, glove, upper, fore }
  }

  #setArm(side, target) {
    const arm = this.arms[side]
    const shoulder = arm.shoulderPos
    const limited = target.clone()
    limited.x = clamp(limited.x, -1.1, 1.1)
    limited.y = clamp(limited.y, 1.2, 2.55)
    limited.z = clamp(limited.z, 0.2, 1.78)

    const elbow = shoulder.clone().lerp(limited, 0.5)
    elbow.x += arm.sideSign * 0.12
    elbow.y += 0.08
    elbow.z -= 0.08
    placeSegment(arm.upper, shoulder, elbow)
    placeSegment(arm.fore, elbow, limited)
    arm.elbow.position.copy(elbow)
    arm.glove.position.copy(limited)
  }

  setPose({ left, right }) {
    if (left) this.pose.left.copy(left)
    if (right) this.pose.right.copy(right)
    this.#setArm('left', this.pose.left)
    this.#setArm('right', this.pose.right)
  }

  update(dt, time = 0) {
    this.group.position.x += (this.bodyX - this.group.position.x) * Math.min(1, dt * 8)
    const bounce = Math.sin(time * 5.2) * 0.012
    this.group.position.y = bounce
  }

  setBodyX(x) {
    this.bodyX = clamp(x, -1.55, 1.55)
  }
  getGloveWorld(side) {
    return this.arms[side].glove.getWorldPosition(new THREE.Vector3())
  }

  getChestWorld() {
    return this.group.localToWorld(vec(0, 1.55, 0.08))
  }

  guardScore() {
    const chest = vec(0, 1.75, 0.2)
    const left = this.pose.left.distanceTo(chest)
    const right = this.pose.right.distanceTo(chest)
    return clamp(1 - Math.min(left, right) / 1.15)
  }

  flashHit(amount = 1) {
    const initial = this.glow.emissiveIntensity
    this.glow.emissiveIntensity = 2.2 + amount * 0.05
    clearTimeout(this.flashTimer)
    this.flashTimer = setTimeout(() => {
      this.glow.emissiveIntensity = initial
    }, 110)
  }
}

