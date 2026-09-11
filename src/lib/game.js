import { clamp } from './controlMath.js'

export class MatchGame {
  constructor() {
    this.duration = 60
    this.reset()
  }

  reset() {
    this.health = [100, 100]
    this.time = this.duration
    this.state = 'standby'
    this.winner = null
    this.lastHit = {
      '0-left': -Infinity,
      '0-right': -Infinity,
      '1-left': -Infinity,
      '1-right': -Infinity,
    }
  }

  start() {
    if (this.health[0] <= 0 || this.health[1] <= 0 || this.time <= 0) this.reset()
    this.state = 'fighting'
  }

  update(dt) {
    if (this.state !== 'fighting') return
    this.time = Math.max(0, this.time - dt)
    if (this.time <= 0) {
      this.state = 'finished'
      this.winner = this.health[0] === this.health[1] ? null : (this.health[0] > this.health[1] ? 0 : 1)
    }
  }

  resolveHit({ attacker, side, distance, extension, speed, guard = 0, now }) {
    if (this.state !== 'fighting') return 0
    if (extension < 0.63 || speed < 0.36 || distance > 1.15) return 0

    const key = `${attacker}-${side}`
    if (now - this.lastHit[key] < 420) return 0
    this.lastHit[key] = now

    const rawDamage = clamp(5.5 + speed * 2.4 + extension * 3.6, 5, 13)
    const damage = rawDamage * (1 - clamp(guard) * 0.55)
    const defender = attacker === 0 ? 1 : 0
    this.health[defender] = clamp(this.health[defender] - damage, 0, 100)

    if (this.health[defender] <= 0) {
      this.state = 'finished'
      this.winner = attacker
    }
    return damage
  }
}
