import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const base = import.meta.env.BASE_URL || './'

async function loadOne(robot, style) {
  const gltf = await loader.loadAsync(`${base}assets/models/${style}.glb`)
  const clips = robot.useVisualModel(gltf.scene, gltf.animations)
  return { style, clips }
}

export async function loadFighterAssets(atlas, brutus) {
  const settled = await Promise.allSettled([
    loadOne(atlas, 'atlas'),
    loadOne(brutus, 'brutus'),
  ])
  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return { ok: true, ...result.value }
    return { ok: false, style: index === 0 ? 'atlas' : 'brutus', error: result.reason }
  })
}

export async function loadArenaAsset() {
  return loader.loadAsync(`${base}assets/models/arena.glb`)
}
