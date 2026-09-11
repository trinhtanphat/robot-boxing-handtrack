import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const steel = new THREE.MeshStandardMaterial({ color: 0x313841, metalness: 0.82, roughness: 0.28 })
const dark = new THREE.MeshStandardMaterial({ color: 0x101419, metalness: 0.35, roughness: 0.62 })
const canvasMat = new THREE.MeshStandardMaterial({ color: 0xe7e4dc, roughness: 0.92 })

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export class Arena {
  constructor(host) {
    this.host = host
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xd9d8d3)
    this.scene.fog = new THREE.Fog(0xd9d8d3, 9, 18)
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60)
    this.camera.position.set(5.4, 4.4, 7.8)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    host.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 1.65, 0)
    this.controls.enableDamping = true
    this.controls.minDistance = 5.4
    this.controls.maxDistance = 12
    this.controls.maxPolarAngle = Math.PI * 0.49

    this.#lights()
    this.#ring()
    this.resize = this.resize.bind(this)
    window.addEventListener('resize', this.resize)
    this.resize()
  }

  #lights() {
    this.scene.add(new THREE.HemisphereLight(0xf4f5ff, 0x40444c, 2.1))
    const key = new THREE.DirectionalLight(0xffffff, 3.4)
    key.position.set(4, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = key.shadow.camera.bottom = -7;
    key.shadow.camera.right = key.shadow.camera.top = 7
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.4)
    rim.position.set(-5, 4, -4)
    this.scene.add(rim)
  }

  #ring() {
    const worldFloor = box(24, 0.18, 24, dark)
    worldFloor.position.y = -0.3
    this.scene.add(worldFloor)

    const apron = box(6.9, 0.45, 6.9, steel)
    apron.position.y = -0.06
    this.scene.add(apron)
    const mat = box(6.35, 0.18, 6.35, canvasMat)
    mat.position.y = 0.25
    this.scene.add(mat)

    const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 2.2, 18)
    const ropeMaterials = [0xc64037, 0xeae9e4, 0x325f9c].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.5 }))
    for (const x of [-3.05, 3.05]) {
      for (const z of [-3.05, 3.05]) {
        const post = new THREE.Mesh(postGeo, steel)
        post.position.set(x, 1.3, z)
        post.castShadow = true
        this.scene.add(post)
      }
    }    const rope = (a, b, y, material) => {
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const length = a.distanceTo(b)
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length, 10), material)
      mesh.position.set(mid.x, y, mid.z)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
      this.scene.add(mesh)
    }
    const corners = [new THREE.Vector3(-3.05, 0, -3.05), new THREE.Vector3(3.05, 0, -3.05), new THREE.Vector3(3.05, 0, 3.05), new THREE.Vector3(-3.05, 0, 3.05)]
    for (let r = 0; r < 3; r += 1) {
      const y = 1.05 + r * 0.42
      for (let i = 0; i < 4; i += 1) rope(corners[i], corners[(i + 1) % 4], y, ropeMaterials[r])
    }

    const grid = new THREE.GridHelper(22, 22, 0x6f747a, 0x4c5055)
    grid.position.y = -0.2
    grid.material.opacity = 0.15
    grid.material.transparent = true
    this.scene.add(grid)
  }

  resize() {
    const w = this.host.clientWidth || innerWidth
    const h = this.host.clientHeight || innerHeight
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  render() {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}

