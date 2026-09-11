import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const base = import.meta.env.BASE_URL || './'
const up = new THREE.Vector3(0, 1, 0)

function placeSegment(mesh, a, b) {
  if (!mesh) return
  const direction = b.clone().sub(a)
  const length = Math.max(direction.length(), 0.001)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.set(1, length, 1)
  mesh.quaternion.setFromUnitVectors(up, direction.normalize())
}

function decorateRobot(robot, gltf) {
  const hiddenFallback = [...robot.group.children]
  hiddenFallback.forEach((child) => { child.visible = false })

  const visual = gltf.scene
  visual.name = `${robot.config.name}_GLB`
  visual.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  robot.group.add(visual)

  const parts = {
    left: {
      upper: visual.getObjectByName('UpperArm_L'),
      lower: visual.getObjectByName('LowerArm_L'),
      elbow: visual.getObjectByName('Elbow_L'),
      glove: visual.getObjectByName('Glove_L'),
    },
    right: {
      upper: visual.getObjectByName('UpperArm_R'),
      lower: visual.getObjectByName('LowerArm_R'),
      elbow: visual.getObjectByName('Elbow_R'),
      glove: visual.getObjectByName('Glove_R'),
    },
  }

  const baseMaterials = new Map()
  visual.traverse((object) => {
    const material = object.isMesh ? object.material : null
    if (material?.emissive && !baseMaterials.has(material)) {
      baseMaterials.set(material, {
        emissive: material.emissive.getHex(),
        emissiveIntensity: material.emissiveIntensity,
      })
    }
  })

  const syncArm = (side) => {
    const source = robot.arms[side]
    const target = robot.pose[side]
    const targetParts = parts[side]
    if (!source || !targetParts) return
    const shoulder = source.shoulderPos
    const elbow = source.elbow.position
    placeSegment(targetParts.upper, shoulder, elbow)
    placeSegment(targetParts.lower, elbow, target)
    targetParts.elbow?.position.copy(elbow)
    targetParts.glove?.position.copy(target)
  }

  const syncPose = () => {
    syncArm('left')
    syncArm('right')
  }

  const originalSetPose = robot.setPose.bind(robot)
  robot.setPose = (pose) => {
    originalSetPose(pose)
    syncPose()
  }

  const mixer = new THREE.AnimationMixer(visual)
  const originalUpdate = robot.update.bind(robot)
  robot.update = (dt, time = 0) => {
    originalUpdate(dt, time)
    mixer.update(dt)
  }

  const originalFlashHit = robot.flashHit.bind(robot)
  robot.flashHit = (amount = 1) => {
    originalFlashHit(amount)
    for (const material of baseMaterials.keys()) {
      material.emissive.set(robot.config.glow)
      material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.55)
    }
    clearTimeout(robot.visualFlashTimer)
    robot.visualFlashTimer = setTimeout(() => {
      for (const [material, state] of baseMaterials) {
        material.emissive.setHex(state.emissive)
        material.emissiveIntensity = state.emissiveIntensity
      }
    }, 120)
  }

  robot.playAnimation = (name) => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name)
    if (!clip) return false
    mixer.stopAllAction()
    const action = mixer.clipAction(clip)
    action.reset().setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    return true
  }

  robot.stopAnimation = () => {
    mixer.stopAllAction()
    syncPose()
  }

  syncPose()
  return gltf.animations.map((clip) => clip.name)
}

async function loadOne(robot, style) {
  const gltf = await loader.loadAsync(`${base}assets/models/${style}.glb`)
  const clips = decorateRobot(robot, gltf)
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
