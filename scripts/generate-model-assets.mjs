import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

class NodeFileReader {
  constructor() { this.result = null; this.onloadend = null; this.onerror = null }
  async readAsArrayBuffer(blob) {
    try { this.result = await blob.arrayBuffer(); this.onloadend?.({ target: this }) }
    catch (error) { this.onerror?.(error) }
  }
  async readAsDataURL(blob) {
    try {
      const data = Buffer.from(await blob.arrayBuffer()).toString('base64')
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${data}`
      this.onloadend?.({ target: this })
    } catch (error) { this.onerror?.(error) }
  }
}

globalThis.FileReader ??= NodeFileReader

const outDir = resolve('public/assets/models')
await mkdir(outDir, { recursive: true })

const up = new THREE.Vector3(0, 1, 0)
const vec = (x, y, z) => new THREE.Vector3(x, y, z)

function material(name, color, metalness = 0.75, roughness = 0.3, emissive = 0x000000) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive })
  mat.name = name
  if (emissive) mat.emissiveIntensity = 1.6
  return mat
}

function namedMesh(name, geometry, mat, parent, position, scale, rotation) {
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.name = name
  if (position) mesh.position.copy(position)
  if (scale) mesh.scale.copy(scale)
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function placeCylinder(mesh, a, b, radiusScale = 1) {
  const direction = b.clone().sub(a)
  const length = Math.max(direction.length(), 0.001)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.set(radiusScale, length, radiusScale)
  mesh.quaternion.setFromUnitVectors(up, direction.normalize())
}

function createRobot(style) {
  const heavy = style === 'brutus'
  const name = heavy ? 'Brutus' : 'Atlas'
  const root = new THREE.Group()
  root.name = `${name}_Root`
  const main = material(`${name}_Paint`, heavy ? 0xa52b27 : 0x176db7, 0.82, 0.23)
  const secondary = material(`${name}_Secondary`, heavy ? 0x4a4d50 : 0xd7e0e7, 0.76, 0.27)
  const dark = material(`${name}_Dark`, 0x171b20, 0.88, 0.2)
  const trim = material(`${name}_Trim`, heavy ? 0x76695e : 0x89a9bd, 0.92, 0.19)
  const gloveMat = material(`${name}_Glove`, heavy ? 0x9d2725 : 0x1260a8, 0.4, 0.38)
  const glowColor = heavy ? 0xff4e32 : 0x45d8ff
  const glow = material(`${name}_Glow`, glowColor, 0.2, 0.2, glowColor)

  namedMesh('Pelvis', new THREE.BoxGeometry(heavy ? 0.94 : 0.78, 0.35, 0.48), dark, root, vec(0, 0.79, 0))
  namedMesh('AbdomenCore', new THREE.CylinderGeometry(0.28, 0.36, 0.52, 8), trim, root, vec(0, 1.12, 0))
  namedMesh('Chest', new THREE.BoxGeometry(heavy ? 1.24 : 1.02, heavy ? 0.92 : 0.86, heavy ? 0.66 : 0.55), main, root, vec(0, 1.55, 0))
  namedMesh('ChestArmor', new THREE.BoxGeometry(heavy ? 0.9 : 0.72, 0.2, heavy ? 0.7 : 0.59), secondary, root, vec(0, 1.71, 0.06))
  namedMesh('ChestGlow', new THREE.BoxGeometry(heavy ? 0.46 : 0.34, 0.09, 0.71), glow, root, vec(0, 1.72, 0.085))
  namedMesh('Neck', new THREE.CylinderGeometry(0.12, 0.16, 0.19, 16), dark, root, vec(0, 2.09, 0))
  namedMesh('Head', new THREE.BoxGeometry(heavy ? 0.54 : 0.47, heavy ? 0.45 : 0.42, 0.5), dark, root, vec(0, 2.38, 0))
  namedMesh('HeadShell', new THREE.BoxGeometry(heavy ? 0.58 : 0.48, 0.12, 0.43), main, root, vec(0, 2.52, -0.01))
  namedMesh('Visor', new THREE.BoxGeometry(heavy ? 0.42 : 0.34, 0.075, 0.515), glow, root, vec(0, 2.41, 0.035))

  const limbGeo = new THREE.CylinderGeometry(heavy ? 0.13 : 0.105, heavy ? 0.12 : 0.095, 1, 16)
  for (const [sideName, sign] of [['L', -1], ['R', 1]]) {
    const shoulder = vec(sign * (heavy ? 0.73 : 0.65), 1.87, 0)
    const elbow = vec(sign * (heavy ? 0.82 : 0.74), 1.58, 0.12)
    const glovePos = vec(sign * (heavy ? 0.62 : 0.56), 1.82, 0.5)
    namedMesh(`Shoulder_${sideName}`, new THREE.SphereGeometry(heavy ? 0.24 : 0.2, 16, 12), dark, root, shoulder)
    namedMesh(`ShoulderArmor_${sideName}`, new THREE.BoxGeometry(heavy ? 0.42 : 0.34, heavy ? 0.33 : 0.26, heavy ? 0.48 : 0.38), main, root, shoulder.clone().add(vec(sign * 0.08, 0.03, 0)))
    const upper = namedMesh(`UpperArm_${sideName}`, limbGeo.clone(), trim, root)
    placeCylinder(upper, shoulder, elbow)
    namedMesh(`Elbow_${sideName}`, new THREE.SphereGeometry(heavy ? 0.16 : 0.14, 14, 10), dark, root, elbow)
    const lower = namedMesh(`LowerArm_${sideName}`, limbGeo.clone(), secondary, root)
    placeCylinder(lower, elbow, glovePos)
    namedMesh(`Glove_${sideName}`, new THREE.IcosahedronGeometry(heavy ? 0.285 : 0.24, 2), gloveMat, root, glovePos)
  }

  for (const [sideName, sign] of [['L', -1], ['R', 1]]) {
    const hip = vec(sign * (heavy ? 0.31 : 0.25), 0.76, 0)
    const knee = vec(sign * (heavy ? 0.34 : 0.28), 0.39, sign * 0.025)
    const ankle = vec(sign * (heavy ? 0.36 : 0.3), 0.09, sign * 0.08)
    const thigh = namedMesh(`Thigh_${sideName}`, new THREE.CylinderGeometry(heavy ? 0.16 : 0.125, heavy ? 0.145 : 0.11, 1, 16), main, root)
    placeCylinder(thigh, hip, knee)
    namedMesh(`Knee_${sideName}`, new THREE.SphereGeometry(heavy ? 0.17 : 0.14, 14, 10), secondary, root, knee)
    const shin = namedMesh(`Shin_${sideName}`, new THREE.CylinderGeometry(heavy ? 0.14 : 0.105, heavy ? 0.12 : 0.095, 1, 16), trim, root)
    placeCylinder(shin, knee, ankle)
    namedMesh(`Foot_${sideName}`, new THREE.BoxGeometry(heavy ? 0.42 : 0.34, 0.15, heavy ? 0.58 : 0.48), dark, root, vec(ankle.x, 0.05, ankle.z + 0.1))
  }

  if (heavy) {
    namedMesh('BackTank_L', new THREE.CylinderGeometry(0.09, 0.09, 0.58, 10), trim, root, vec(-0.38, 1.47, -0.36))
    namedMesh('BackTank_R', new THREE.CylinderGeometry(0.09, 0.09, 0.58, 10), trim, root, vec(0.38, 1.47, -0.36))
  }

  const clips = createRobotClips(root, heavy)
  return { root, clips }
}

function createRobotClips(root, heavy) {
  const left = root.getObjectByName('Glove_L')
  const right = root.getObjectByName('Glove_R')
  const chest = root.getObjectByName('Chest')
  const l0 = left.position.clone(), r0 = right.position.clone()
  const clip = (name, duration, tracks) => new THREE.AnimationClip(name, duration, tracks)
  const posTrack = (node, times, values) => new THREE.VectorKeyframeTrack(`${node.name}.position`, times, values.flatMap(v => [v.x, v.y, v.z]))
  const rotTrack = (node, times, zValues) => new THREE.NumberKeyframeTrack(`${node.name}.rotation[z]`, times, zValues)
  const jab = l0.clone().add(vec(0, 0, heavy ? 0.65 : 0.78))
  const cross = r0.clone().add(vec(0, 0, heavy ? 0.72 : 0.86))
  const hook = r0.clone().add(vec(heavy ? -0.42 : -0.52, 0.08, 0.45))
  return [
    clip('Idle', 1.2, [posTrack(left, [0,0.6,1.2], [l0,l0.clone().add(vec(0,0.02,0)),l0]), posTrack(right, [0,0.6,1.2], [r0,r0.clone().add(vec(0,-0.02,0)),r0])]),
    clip('Guard', 0.7, [posTrack(left,[0,0.7],[l0,l0.clone().add(vec(0.12,0.15,-0.08))]), posTrack(right,[0,0.7],[r0,r0.clone().add(vec(-0.12,0.15,-0.08))])]),
    clip('Jab', 0.45, [posTrack(left,[0,0.18,0.45],[l0,jab,l0])]),
    clip('Cross', 0.5, [posTrack(right,[0,0.2,0.5],[r0,cross,r0]), rotTrack(chest,[0,0.2,0.5],[0,heavy?-0.12:-0.18,0])]),
    clip('Hook', 0.6, [posTrack(right,[0,0.28,0.6],[r0,hook,r0])]),
    clip('DodgeLeft', 0.55, [rotTrack(chest,[0,0.25,0.55],[0,heavy?0.1:0.16,0])]),
    clip('DodgeRight', 0.55, [rotTrack(chest,[0,0.25,0.55],[0,heavy?-0.1:-0.16,0])]),
    clip('Victory', 1.2, [posTrack(left,[0,0.7,1.2],[l0,l0.clone().add(vec(-0.1,0.65,-0.05)),l0.clone().add(vec(-0.1,0.65,-0.05))]), posTrack(right,[0,0.7,1.2],[r0,r0.clone().add(vec(0.1,0.65,-0.05)),r0.clone().add(vec(0.1,0.65,-0.05))])]),
  ]
}

function createArena() {
  const root = new THREE.Group(); root.name = 'Arena_Root'
  const steel = material('ArenaSteel', 0x232b34, 0.9, 0.24)
  const dark = material('ArenaDark', 0x080c12, 0.5, 0.55)
  const floor = material('ArenaFloor', 0x1a2028, 0.75, 0.38)
  const blue = material('AtlasEnergy', 0x238dff, 0.25, 0.18, 0x238dff)
  const red = material('BrutusEnergy', 0xff3b30, 0.25, 0.18, 0xff3b30)
  namedMesh('WorldFloor', new THREE.CylinderGeometry(8.8, 8.8, 0.18, 48), dark, root, vec(0,-0.34,0))
  namedMesh('Platform', new THREE.BoxGeometry(7.1,0.46,7.1), steel, root, vec(0,-0.05,0))
  namedMesh('RingFloor', new THREE.BoxGeometry(6.4,0.18,6.4), floor, root, vec(0,0.25,0))
  for (const x of [-3.05,3.05]) for (const z of [-3.05,3.05]) namedMesh(`Post_${x}_${z}`, new THREE.CylinderGeometry(0.1,0.12,2.3,16), steel, root, vec(x,1.3,z))
  const corners = [vec(-3.05,0,-3.05),vec(3.05,0,-3.05),vec(3.05,0,3.05),vec(-3.05,0,3.05)]
  let ropeId = 0
  for (let level=0; level<3; level++) {
    const y = 1.02 + level*0.42
    for (let i=0;i<4;i++) {
      const a=corners[i], b=corners[(i+1)%4]
      const rope=namedMesh(`Rope_${ropeId++}`,new THREE.CylinderGeometry(0.025,0.025,1,10), i<2?blue:red, root)
      placeCylinder(rope, vec(a.x,y,a.z), vec(b.x,y,b.z))
    }
  }
  namedMesh('ScoreboardRing', new THREE.TorusGeometry(2.25,0.18,12,48), steel, root, vec(0,4.7,0), null, vec(Math.PI/2,0,0))
  for (let i=0;i<12;i++) {
    const a=(i/12)*Math.PI*2
    const light=namedMesh(`RigLight_${i}`,new THREE.BoxGeometry(0.18,0.1,0.4), i%2?red:blue, root, vec(Math.cos(a)*2.6,4.45,Math.sin(a)*2.6))
    light.lookAt(0,1.5,0)
  }
  return root
}

async function exportGlb(object, animations, filename) {
  const exporter = new GLTFExporter()
  const arrayBuffer = await exporter.parseAsync(object, { binary: true, animations, trs: true, onlyVisible: true })
  const bytes = Buffer.from(arrayBuffer)
  await writeFile(resolve(outDir, filename), bytes)
  console.log(`${filename}: ${(bytes.length / 1024).toFixed(1)} KiB`)
}

const atlas = createRobot('atlas')
const brutus = createRobot('brutus')
await exportGlb(atlas.root, atlas.clips, 'atlas.glb')
await exportGlb(brutus.root, brutus.clips, 'brutus.glb')
await exportGlb(createArena(), [], 'arena.glb')
