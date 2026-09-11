import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const steel = new THREE.MeshStandardMaterial({ color: 0x252b33, metalness: 0.88, roughness: 0.24 })
const dark = new THREE.MeshStandardMaterial({ color: 0x070b11, metalness: 0.5, roughness: 0.5 })
const floorMat = new THREE.MeshStandardMaterial({ color: 0x111821, metalness: 0.68, roughness: 0.34 })
const matSurface = new THREE.MeshStandardMaterial({ color: 0x202c37, metalness: 0.5, roughness: 0.42 })

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function emissive(color, intensity = 2.3) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: 0.18, roughness: 0.25 })
}

export class Arena {
  constructor(host) {
    this.host = host
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x05080d)
    this.scene.fog = new THREE.FogExp2(0x05080d, 0.055)
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
    this.camera.position.set(6.7, 4.8, 8.9)
    this.baseCamera = this.camera.position.clone()
    this.effects = []
    this.shakePower = 0
    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.18
    host.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 1.45, 0)
    this.controls.enableDamping = true
    this.controls.minDistance = 5.2
    this.controls.maxDistance = 14
    this.controls.maxPolarAngle = Math.PI * 0.48

    this.#lights()
    this.#arenaFloor()
    this.#ring()
    this.#scoreboard()
    this.#crowd()
    this.resize = this.resize.bind(this)
    window.addEventListener('resize', this.resize)
    this.resize()
  }

  #lights() {
    this.scene.add(new THREE.HemisphereLight(0x86a7cc, 0x08090d, 1.15))

    const key = new THREE.SpotLight(0xeaf6ff, 95, 24, Math.PI / 7, 0.4, 1.2)
    key.position.set(4, 10, 6)
    key.target.position.set(0, 0.8, 0)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    this.scene.add(key, key.target)

    const blue = new THREE.SpotLight(0x219dff, 52, 18, Math.PI / 6, 0.55, 1.3)
    blue.position.set(-6, 5, 3)
    blue.target.position.set(-1, 1.2, 0)
    this.scene.add(blue, blue.target)

    const red = new THREE.SpotLight(0xff4c32, 52, 18, Math.PI / 6, 0.55, 1.3)
    red.position.set(6, 5, -3)
    red.target.position.set(1, 1.2, 0)
    this.scene.add(red, red.target)
  }

  #arenaFloor() {
    const world = box(28, 0.22, 28, dark)
    world.position.y = -0.42
    this.scene.add(world)

    const grid = new THREE.GridHelper(26, 26, 0x1f76aa, 0x192633)
    grid.position.y = -0.29
    grid.material.opacity = 0.19
    grid.material.transparent = true
    this.scene.add(grid)

    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.2 + i * 1.2, 5.25 + i * 1.2, 64), emissive(i % 2 ? 0x253d56 : 0x17314a, 0.55))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = -0.275
      this.scene.add(ring)
    }
  }

  #ring() {
    const apron = box(7.55, 0.55, 7.55, steel)
    apron.position.y = -0.05
    this.scene.add(apron)

    const mat = box(6.75, 0.19, 6.75, matSurface)
    mat.position.y = 0.32
    this.scene.add(mat)

    const centerGlow = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.86, 48), emissive(0xbcd8ef, 1.25))
    centerGlow.rotation.x = -Math.PI / 2
    centerGlow.position.y = 0.425
    this.scene.add(centerGlow)

    const centerCore = new THREE.Mesh(new THREE.CircleGeometry(0.28, 6), emissive(0x87cfff, 1.8))
    centerCore.rotation.x = -Math.PI / 2
    centerCore.position.y = 0.428
    this.scene.add(centerCore)

    for (let x = -2.5; x <= 2.5; x += 1.25) {
      for (let z = -2.5; z <= 2.5; z += 1.25) {
        const seam = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.425, -3.2), new THREE.Vector3(x, 0.425, 3.2)]),
          new THREE.LineBasicMaterial({ color: 0x516575, transparent: true, opacity: 0.16 }),
        )
        this.scene.add(seam)
        if (z === -2.5) {
          const seamZ = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.2, 0.425, x), new THREE.Vector3(3.2, 0.425, x)]),
            new THREE.LineBasicMaterial({ color: 0x516575, transparent: true, opacity: 0.16 }),
          )
          this.scene.add(seamZ)
        }
      }
    }

    const postGeo = new THREE.BoxGeometry(0.2, 2.55, 0.2)
    const corners = [
      [-3.18, -3.18, 0x1e9fff], [3.18, -3.18, 0xff4a30],
      [3.18, 3.18, 0xff4a30], [-3.18, 3.18, 0x1e9fff],
    ]
    for (const [x, z, color] of corners) {
      const post = new THREE.Mesh(postGeo, steel)
      post.position.set(x, 1.5, z)
      post.castShadow = true
      this.scene.add(post)
      const strip = box(0.035, 1.95, 0.23, emissive(color, 2.8))
      strip.position.set(x + (x < 0 ? -0.105 : 0.105), 1.52, z)
      this.scene.add(strip)
    }

    const rope = (a, b, y, material) => {
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const length = a.distanceTo(b)
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, length, 10), material)
      mesh.position.set(mid.x, y, mid.z)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
      this.scene.add(mesh)
    }

    const c = [
      new THREE.Vector3(-3.18, 0, -3.18), new THREE.Vector3(3.18, 0, -3.18),
      new THREE.Vector3(3.18, 0, 3.18), new THREE.Vector3(-3.18, 0, 3.18),
    ]
    for (let r = 0; r < 3; r += 1) {
      const y = 1.12 + r * 0.46
      for (let i = 0; i < 4; i += 1) {
        const sideColor = i < 2 ? 0xff4c32 : 0x209dff
        rope(c[i], c[(i + 1) % 4], y, emissive(sideColor, 2.15))
      }
    }
  }

  #scoreboard() {
    this.scoreboard = new THREE.Group()
    this.scoreboard.position.y = 5.9
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.16, 12, 64), steel)
    torus.rotation.x = Math.PI / 2
    this.scoreboard.add(torus)

    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(2.13, 0.035, 8, 64), emissive(0x7fcfff, 2.4))
    glowRing.rotation.x = Math.PI / 2
    this.scoreboard.add(glowRing)

    for (let i = 0; i < 4; i += 1) {
      const panel = box(1.5, 0.72, 0.08, emissive(i % 2 ? 0xff4933 : 0x168dff, 1.35))
      const a = i * Math.PI / 2
      panel.position.set(Math.sin(a) * 2.1, -0.25, Math.cos(a) * 2.1)
      panel.rotation.y = a
      this.scoreboard.add(panel)
    }
    this.scene.add(this.scoreboard)
  }

  #crowd() {
    const geometry = new THREE.BoxGeometry(0.12, 0.34, 0.12)
    const material = new THREE.MeshStandardMaterial({ color: 0x151c24, emissive: 0x0a1118, roughness: 0.75 })
    const crowd = new THREE.InstancedMesh(geometry, material, 180)
    const dummy = new THREE.Object3D()
    let index = 0
    for (let row = 0; row < 5; row += 1) {
      const radius = 5.7 + row * 0.68
      const count = 36
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2
        dummy.position.set(Math.sin(a) * radius, 0.22 + row * 0.22, Math.cos(a) * radius)
        dummy.scale.y = 0.75 + ((i * 13 + row * 7) % 10) / 18
        dummy.lookAt(0, 1, 0)
        dummy.updateMatrix()
        crowd.setMatrixAt(index++, dummy.matrix)
      }
    }
    crowd.instanceMatrix.needsUpdate = true
    this.scene.add(crowd)
  }

  impact(position, color = 0xffffff) {
    const group = new THREE.Group()
    group.position.copy(position)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), emissive(color, 6))
    group.add(core)
    for (let i = 0; i < 10; i += 1) {
      const spark = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.26), emissive(color, 4))
      spark.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      spark.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 2.6, Math.random() * 1.9, (Math.random() - 0.5) * 2.6)
      group.add(spark)
    }
    group.userData.birth = performance.now()
    this.effects.push(group)
    this.scene.add(group)
    this.shakePower = Math.min(0.16, this.shakePower + 0.07)
  }

  #updateEffects() {
    const now = performance.now()
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i]
      const age = (now - effect.userData.birth) / 1000
      if (age > 0.45) {
        this.scene.remove(effect)
        effect.traverse((node) => {
          node.geometry?.dispose?.()
          if (node.material && !Array.isArray(node.material)) node.material.dispose?.()
        })
        this.effects.splice(i, 1)
        continue
      }
      effect.scale.setScalar(1 + age * 2.5)
      effect.children.slice(1).forEach((spark) => spark.position.addScaledVector(spark.userData.velocity, 0.016))
      effect.children.forEach((child) => { child.material.transparent = true; child.material.opacity = 1 - age / 0.45 })
    }
  }

  resize() {
    const w = this.host.clientWidth || innerWidth
    const h = this.host.clientHeight || innerHeight
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.scoreboard) this.scoreboard.rotation.y += dt * 0.08
    this.#updateEffects()
    this.controls.update()
    if (this.shakePower > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakePower
      this.camera.position.y += (Math.random() - 0.5) * this.shakePower * 0.4
      this.shakePower *= 0.82
    }
    this.renderer.render(this.scene, this.camera)
  }
}
