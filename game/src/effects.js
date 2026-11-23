// Effects: particles, skid marks, muzzle flashes, explosions and screen
// shake. Purely visual — nothing here changes the rules.
export function createEffects() {
  return {
    particles: [],
    skids: [],
    flashes: [],
    shake: 0,
    rings: [],
  };
}

export function spawnParticles(effects, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    effects.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
    });
  }
}

export function spawnExplosion(effects, x, y) {
  spawnParticles(effects, x, y, 26, '#ff9a3d', 260, 0.7, 5);
  spawnParticles(effects, x, y, 18, '#ffd23f', 180, 0.5, 4);
  spawnParticles(effects, x, y, 14, '#5a5a5a', 90, 1.1, 7);
  effects.rings.push({ x, y, r: 8, life: 0.45, maxLife: 0.45 });
  effects.shake = Math.max(effects.shake, 14);
}

export function addSkid(effects, x, y, angle) {
  effects.skids.push({ x, y, angle, life: 6 });
  if (effects.skids.length > 400) effects.skids.shift();
}

export function addFlash(effects, x, y) {
  effects.flashes.push({ x, y, life: 0.06 });
}

export function stepEffects(effects, dt) {
  for (let i = effects.particles.length - 1; i >= 0; i -= 1) {
    const p = effects.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      effects.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.5 * dt);
    p.vy *= Math.exp(-2.5 * dt);
  }
  for (let i = effects.skids.length - 1; i >= 0; i -= 1) {
    effects.skids[i].life -= dt;
    if (effects.skids[i].life <= 0) effects.skids.splice(i, 1);
  }
  for (let i = effects.flashes.length - 1; i >= 0; i -= 1) {
    effects.flashes[i].life -= dt;
    if (effects.flashes[i].life <= 0) effects.flashes.splice(i, 1);
  }
  for (let i = effects.rings.length - 1; i >= 0; i -= 1) {
    const r = effects.rings[i];
    r.life -= dt;
    r.r += 260 * dt;
    if (r.life <= 0) effects.rings.splice(i, 1);
  }
  effects.shake = Math.max(0, effects.shake - 30 * dt);
}

export function drawEffects(ctx, effects) {
  // Skid marks under everything else.
  ctx.fillStyle = 'rgba(20,20,20,0.4)';
  for (const s of effects.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = Math.min(1, s.life / 6) * 0.55;
    ctx.fillRect(-9, -2, 18, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const p of effects.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const r of effects.rings) {
    ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
    ctx.strokeStyle = '#ffb84d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of effects.flashes) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
