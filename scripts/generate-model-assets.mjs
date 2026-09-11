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
const v = (x, y, z) => new THREE.Vector3(x, y, z)

function mat(name, color, metalness = .75, roughness = .3, emissive = 0) {
  const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive })
  m.name = name
  if (emissive) m.emissiveIntensity = 1.6
  return m
}

function mesh(name, geometry, material, parent, position = null, rotation = null) {
  const m = new THREE.Mesh(geometry, material)
  m.name = name
  if (position) m.position.copy(position)
  if (rotation) m.rotation.set(rotation.x, rotation.y, rotation.z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}

function segment(node, a, b) {
  const d = b.clone().sub(a)
  node.position.copy(a).add(b).multiplyScalar(.5)
  node.scale.set(1, Math.max(d.length(), .001), 1)
  node.quaternion.setFromUnitVectors(up, d.normalize())
}

function robot(style) {
  const heavy = style === 'brutus'
  const title = heavy ? 'Brutus' : 'Atlas'
  const root = new THREE.Group(); root.name = `${title}_Root`
  const main = mat(`${title}_Paint`, heavy ? 0xa52b27 : 0x176db7, .82, .23)
  const secondary = mat(`${title}_Secondary`, heavy ? 0x4a4d50 : 0xd7e0e7, .76, .27)
  const dark = mat(`${title}_Dark`, 0x171b20, .88, .2)
  const trim = mat(`${title}_Trim`, heavy ? 0x76695e : 0x89a9bd, .92, .19)
  const glove = mat(`${title}_Glove`, heavy ? 0x9d2725 : 0x1260a8, .4, .38)
  const glowColor = heavy ? 0xff4e32 : 0x45d8ff
  const glow = mat(`${title}_Glow`, glowColor, .2, .2, glowColor)

  mesh('Pelvis', new THREE.BoxGeometry(heavy ? .94 : .78, .35, .48), dark, root, v(0,.79,0))
  mesh('AbdomenCore', new THREE.CylinderGeometry(.28,.36,.52,8), trim, root, v(0,1.12,0))
  mesh('Chest', new THREE.BoxGeometry(heavy ? 1.24 : 1.02, heavy ? .92 : .86, heavy ? .66 : .55), main, root, v(0,1.55,0))
  mesh('ChestArmor', new THREE.BoxGeometry(heavy ? .9 : .72,.2,heavy ? .7 : .59), secondary, root, v(0,1.71,.06))
  mesh('ChestGlow', new THREE.BoxGeometry(heavy ? .46 : .34,.09,.71), glow, root, v(0,1.72,.085))
  mesh('Neck', new THREE.CylinderGeometry(.12,.16,.19,16), dark, root, v(0,2.09,0))
  mesh('Head', new THREE.BoxGeometry(heavy ? .54 : .47, heavy ? .45 : .42,.5), dark, root, v(0,2.38,0))
  mesh('HeadShell', new THREE.BoxGeometry(heavy ? .58 : .48,.12,.43), main, root, v(0,2.52,-.01))
  mesh('Visor', new THREE.BoxGeometry(heavy ? .42 : .34,.075,.515), glow, root, v(0,2.41,.035))

  for (const [side, sign] of [['L',-1],['R',1]]) {
    const s = v(sign * (heavy ? .73 : .65),1.87,0)
    const e = v(sign * (heavy ? .82 : .74),1.58,.12)
    const g = v(sign * (heavy ? .62 : .56),1.82,.5)
    mesh(`Shoulder_${side}`, new THREE.SphereGeometry(heavy ? .24 : .2,16,12), dark, root, s)
    mesh(`ShoulderArmor_${side}`, new THREE.BoxGeometry(heavy ? .42 : .34, heavy ? .33 : .26, heavy ? .48 : .38), main, root, s.clone().add(v(sign*.08,.03,0)))
    const upper = mesh(`UpperArm_${side}`, new THREE.CylinderGeometry(heavy ? .13 : .105, heavy ? .12 : .095,1,16), trim, root); segment(upper,s,e)
    mesh(`Elbow_${side}`, new THREE.SphereGeometry(heavy ? .16 : .14,14,10), dark, root, e)
    const lower = mesh(`LowerArm_${side}`, new THREE.CylinderGeometry(heavy ? .14 : .105, heavy ? .13 : .095,1,16), secondary, root); segment(lower,e,g)
    mesh(`Glove_${side}`, new THREE.IcosahedronGeometry(heavy ? .285 : .24,2), glove, root, g)
  }

  for (const [side, sign] of [['L',-1],['R',1]]) {
    const h=v(sign*(heavy?.31:.25),.76,0), k=v(sign*(heavy?.34:.28),.39,sign*.025), a=v(sign*(heavy?.36:.3),.09,sign*.08)
    const thigh=mesh(`Thigh_${side}`,new THREE.CylinderGeometry(heavy?.16:.125,heavy?.145:.11,1,16),main,root); segment(thigh,h,k)
    mesh(`Knee_${side}`,new THREE.SphereGeometry(heavy?.17:.14,14,10),secondary,root,k)
    const shin=mesh(`Shin_${side}`,new THREE.CylinderGeometry(heavy?.14:.105,heavy?.12:.095,1,16),trim,root); segment(shin,k,a)
    mesh(`Foot_${side}`,new THREE.BoxGeometry(heavy?.42:.34,.15,heavy?.58:.48),dark,root,v(a.x,.05,a.z+.1))
  }
  if (heavy) {
    mesh('BackTank_L',new THREE.CylinderGeometry(.09,.09,.58,10),trim,root,v(-.38,1.47,-.36))
    mesh('BackTank_R',new THREE.CylinderGeometry(.09,.09,.58,10),trim,root,v(.38,1.47,-.36))
  }
  return { root, clips: clips(root, heavy) }
}

function clips(root, heavy) {
  const left=root.getObjectByName('Glove_L'), right=root.getObjectByName('Glove_R'), chest=root.getObjectByName('Chest')
  const l0=left.position.clone(), r0=right.position.clone()
  const p=(node,times,values)=>new THREE.VectorKeyframeTrack(`${node.name}.position`,times,values.flatMap(x=>[x.x,x.y,x.z]))
  const q=(node,times,zValues)=>new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`,times,zValues.flatMap(z=>{
    const quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,z)); return [quat.x,quat.y,quat.z,quat.w]
  }))
  const c=(name,duration,tracks)=>new THREE.AnimationClip(name,duration,tracks)
  const jab=l0.clone().add(v(0,0,heavy?.65:.78)), cross=r0.clone().add(v(0,0,heavy?.72:.86)), hook=r0.clone().add(v(heavy?-.42:-.52,.08,.45))
  return [
    c('Idle',1.2,[p(left,[0,.6,1.2],[l0,l0.clone().add(v(0,.02,0)),l0]),p(right,[0,.6,1.2],[r0,r0.clone().add(v(0,-.02,0)),r0])]),
    c('Guard',.7,[p(left,[0,.7],[l0,l0.clone().add(v(.12,.15,-.08))]),p(right,[0,.7],[r0,r0.clone().add(v(-.12,.15,-.08))])]),
    c('Jab',.45,[p(left,[0,.18,.45],[l0,jab,l0])]),
    c('Cross',.5,[p(right,[0,.2,.5],[r0,cross,r0]),q(chest,[0,.2,.5],[0,heavy?-.12:-.18,0])]),
    c('Hook',.6,[p(right,[0,.28,.6],[r0,hook,r0])]),
    c('DodgeLeft',.55,[q(chest,[0,.25,.55],[0,heavy?.1:.16,0])]),
    c('DodgeRight',.55,[q(chest,[0,.25,.55],[0,heavy?-.1:-.16,0])]),
    c('Victory',1.2,[p(left,[0,.7,1.2],[l0,l0.clone().add(v(-.1,.65,-.05)),l0.clone().add(v(-.1,.65,-.05))]),p(right,[0,.7,1.2],[r0,r0.clone().add(v(.1,.65,-.05)),r0.clone().add(v(.1,.65,-.05))])]),
  ]
}

function arena() {
  const root=new THREE.Group(); root.name='Arena_Root'
  const steel=mat('ArenaSteel',0x232b34,.9,.24), dark=mat('ArenaDark',0x080c12,.5,.55), floor=mat('ArenaFloor',0x1a2028,.75,.38)
  const blue=mat('AtlasEnergy',0x238dff,.25,.18,0x238dff), red=mat('BrutusEnergy',0xff3b30,.25,.18,0xff3b30)
  mesh('WorldFloor',new THREE.CylinderGeometry(8.8,8.8,.18,48),dark,root,v(0,-.34,0))
  mesh('Platform',new THREE.BoxGeometry(7.1,.46,7.1),steel,root,v(0,-.05,0))
  mesh('RingFloor',new THREE.BoxGeometry(6.4,.18,6.4),floor,root,v(0,.25,0))
  for (const x of [-3.05,3.05]) for (const z of [-3.05,3.05]) mesh(`Post_${x}_${z}`,new THREE.CylinderGeometry(.1,.12,2.3,16),steel,root,v(x,1.3,z))
  const corners=[v(-3.05,0,-3.05),v(3.05,0,-3.05),v(3.05,0,3.05),v(-3.05,0,3.05)]; let id=0
  for (let level=0;level<3;level++) for (let i=0;i<4;i++) {
    const y=1.02+level*.42, a=corners[i], b=corners[(i+1)%4]
    const rope=mesh(`Rope_${id++}`,new THREE.CylinderGeometry(.025,.025,1,10),i<2?blue:red,root); segment(rope,v(a.x,y,a.z),v(b.x,y,b.z))
  }
  mesh('ScoreboardRing',new THREE.TorusGeometry(2.25,.18,12,48),steel,root,v(0,4.7,0),v(Math.PI/2,0,0))
  for (let i=0;i<12;i++) { const a=i/12*Math.PI*2; const light=mesh(`RigLight_${i}`,new THREE.BoxGeometry(.18,.1,.4),i%2?red:blue,root,v(Math.cos(a)*2.6,4.45,Math.sin(a)*2.6)); light.lookAt(0,1.5,0) }
  return root
}

async function writeGlb(object, animations, filename) {
  const data=await new GLTFExporter().parseAsync(object,{ binary:true, animations, trs:true, onlyVisible:true })
  const bytes=Buffer.from(data); await writeFile(resolve(outDir,filename),bytes)
  console.log(`${filename}: ${(bytes.length/1024).toFixed(1)} KiB`)
}

const atlas=robot('atlas'), brutus=robot('brutus')
await writeGlb(atlas.root,atlas.clips,'atlas.glb')
await writeGlb(brutus.root,brutus.clips,'brutus.glb')
await writeGlb(arena(),[],'arena.glb')
