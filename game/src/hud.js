// The HUD: wanted stars, health, money, objective, clock, district, speed and
// ammo — plus the minimap, dialogue box, banners and the title/pause screens.
// Everything is drawn on the main canvas, in screen space.
import { LANDMARKS } from './world.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12,16,24,${alpha ?? 0.72})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function star(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.lineTo(Math.cos(a2) * size * 0.45, Math.sin(a2) * size * 0.45);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, view, game) {
  const { player, police, missions, city, time } = game;
  const w = view.w;
  const h = view.h;

  // ---- Top-left: wanted stars, health, money. ----
  panel(ctx, 12, 12, 210, 86, 0.72);
  for (let i = 0; i < 5; i += 1) star(ctx, 30 + i * 26, 32, 10, i < police.stars);
  text(ctx, `Health ${Math.max(0, Math.ceil(player.health))}`, 20, 58, 13, '#eef1f5', 'left', true);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(88, 48, 120, 10);
  ctx.fillStyle = player.health > 30 ? '#7ac74f' : '#e5534b';
  ctx.fillRect(88, 48, 120 * Math.max(0, player.health) / 100, 10);
  text(ctx, `$${Math.floor(player.money)}`, 20, 88, 20, '#7ac74f', 'left', true);
  text(ctx, player.car ? player.car.name : 'On foot', 120, 88, 13, '#c9d1de', 'left');

  // ---- Top-centre: clock and district. ----
  const hours = Math.floor(game.clock / 60) % 24;
  const minutes = Math.floor(game.clock % 60);
  const clockText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const district = city.districtAt(player.car ? player.car.x : player.x, player.car ? player.car.y : player.y);
  const districtName = { downtown: 'Downtown', oldTown: 'Old Town', harbour: 'Harbour', suburbs: 'Palms' }[district] || 'Solmar Bay';
  panel(ctx, w / 2 - 90, 12, 180, 44, 0.72);
  text(ctx, clockText, w / 2, 32, 18, '#eef1f5', 'center', true);
  text(ctx, districtName, w / 2, 50, 12, '#c9d1de', 'center');

  // ---- Top-right: mission objective. ----
  const objective = game.objectiveText;
  const mission = missions.index < 5 ? missions.index + 1 : 5;
  panel(ctx, w - 312, 12, 300, 64, 0.72);
  text(ctx, missions.active ? `JOB ${mission}/5` : 'SOLMAR BAY', w - 300, 32, 13, '#ffd94a', 'left', true);
  wrapText(ctx, objective, w - 300, 50, 276, 13, '#eef1f5');
  if (missions.active && missions.timer > 0) {
    text(ctx, `${Math.ceil(missions.timer)}s`, w - 24, 32, 16, missions.timer < 30 ? '#ff6b5e' : '#eef1f5', 'right', true);
  }

  // ---- Bottom-left: speed or weapon. ----
  if (player.car) {
    const kmh = Math.round(Math.hypot(player.car.vx, player.car.vy) * 0.32);
    panel(ctx, 12, h - 64, 150, 52, 0.72);
    text(ctx, `${kmh}`, 24, h - 30, 26, '#eef1f5', 'left', true);
    text(ctx, 'km/h', 82, h - 30, 13, '#c9d1de', 'left');
    text(ctx, 'E exit   Space brake', 24, h - 16, 11, '#8b93a3', 'left');
  } else {
    panel(ctx, 12, h - 64, 190, 52, 0.72);
    text(ctx, `Pistol  ${player.ammo} / 120`, 24, h - 30, 16, '#eef1f5', 'left', true);
    text(ctx, 'E enter car   F punch   Click shoot', 24, h - 16, 11, '#8b93a3', 'left');
  }

  // ---- Bottom-right: minimap. ----
  drawMinimap(ctx, view, game);

  // ---- Dialogue box. ----
  if (missions.dialogue && missions.dialogueTimer > 0) {
    const dw = Math.min(640, w - 40);
    panel(ctx, (w - dw) / 2, h - 148, dw, 62, 0.85);
    text(ctx, missions.dialogue.speaker, (w - dw) / 2 + 16, h - 124, 13, '#ffd94a', 'left', true);
    wrapText(ctx, missions.dialogue.text, (w - dw) / 2 + 16, h - 104, dw - 32, 13, '#eef1f5');
  }

  // ---- Centre banner (mission complete / failed / wasted / busted). ----
  if (game.banner && game.bannerTimer > 0) {
    const alpha = Math.min(1, game.bannerTimer);
    ctx.globalAlpha = alpha;
    text(ctx, game.banner, w / 2, h * 0.32, 44, game.bannerColor || '#ffd94a', 'center', true);
    if (game.bannerSub) text(ctx, game.bannerSub, w / 2, h * 0.32 + 30, 16, '#eef1f5', 'center');
    ctx.globalAlpha = 1;
  }
  void time;
}

function wrapText(ctx, value, x, y, maxWidth, size, color) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const words = String(value).split(' ');
  let line = '';
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += size + 4;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
}

function drawMinimap(ctx, view, game) {
  const { city, player, police, missions } = game;
  const mw = 200;
  const mh = 146;
  const mx = view.w - mw - 12;
  const my = view.h - mh - 12;
  panel(ctx, mx - 6, my - 6, mw + 12, mh + 12, 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  // The city, shrunk.
  ctx.drawImage(city.layer, 0, 0, 3600, 2600, mx, my, mw, mh);
  const sx = mw / 3600;
  const sy = mh / 2600;
  // Landmarks.
  for (const key of Object.keys(LANDMARKS)) {
    const mark = LANDMARKS[key];
    ctx.fillStyle = mark.color;
    ctx.fillRect(mx + mark.x * sx - 2, my + mark.y * sy - 2, 4, 4);
  }
  // Mission target: a pulsing yellow diamond.
  const target = game.missionTarget;
  if (target) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd94a';
    ctx.save();
    ctx.translate(mx + target.x * sx, my + target.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  // Police blips.
  for (const car of police.cars) {
    ctx.fillStyle = '#2a6bff';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of police.cops) {
    ctx.fillStyle = '#6ea8ff';
    ctx.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
  }
  // The player: a white arrow.
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const pa = player.car ? player.car.angle : player.angle;
  ctx.save();
  ctx.translate(mx + px * sx, my + py * sy);
  ctx.rotate(pa);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  text(ctx, 'N', mx + mw / 2, my - 10, 11, '#c9d1de', 'center', true);
}

export function drawTitle(ctx, view, game) {
  const w = view.w;
  const h = view.h;
  // Sun-soaked gradient sky over a dark city silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#c65f6e');
  grad.addColorStop(1, '#2c3550');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  text(ctx, 'SOLMAR BAY', w / 2, h * 0.3, 64, '#ffffff', 'center', true);
  text(ctx, 'AN OPEN-WORLD CRIME STORY', w / 2, h * 0.3 + 34, 18, '#ffd94a', 'center', true);
  const story = 'Milo Kade is back in Solmar Bay with $120 and a borrowed jacket. Lena Cruz has work: five jobs, one city, and every cop in town. Steal cars, run the streets, and take the big score.';
  wrapText(ctx, story, w / 2 - 320, h * 0.42, 640, 15, '#eef1f5');
  ctx.textAlign = 'center';
  const controls = [
    'WASD move / drive    Mouse aim    Click shoot    E enter & exit cars',
    'F punch    Shift sprint    Space handbrake    N start the next job    P pause    M mute',
  ];
  controls.forEach((line, i) => text(ctx, line, w / 2, h * 0.56 + i * 24, 14, '#c9d1de', 'center'));
  // Buttons.
  const bw = 260;
  const bx = w / 2 - bw / 2;
  const hasSave = game.hasSave;
  const buttons = [];
  const startY = h * 0.68;
  panel(ctx, bx, startY, bw, 52, 0.9);
  text(ctx, hasSave ? 'CONTINUE' : 'START', w / 2, startY + 34, 20, '#ffd94a', 'center', true);
  buttons.push({ id: 'start', x: bx, y: startY, w: bw, h: 52 });
  panel(ctx, bx, startY + 64, bw, 40, 0.7);
  text(ctx, 'HOW TO PLAY', w / 2, startY + 90, 14, '#eef1f5', 'center', true);
  buttons.push({ id: 'how', x: bx, y: startY + 64, w: bw, h: 40 });
  if (game.showHelp) {
    panel(ctx, w / 2 - 330, h * 0.68 + 120, 660, 120, 0.92);
    const help = 'On foot: WASD to walk, Shift to sprint, click to shoot, F to punch, E to steal a car. In a car: W/S to drive, A/D to steer, Space to handbrake. Crimes raise your wanted stars — lose the cops by breaking line of sight. Missions pay cash; cash buys faster cars at Vic\'s Garage.';
    wrapText(ctx, help, w / 2 - 314, h * 0.68 + 148, 628, 13, '#eef1f5');
  }
  return buttons;
}

export function drawPaused(ctx, view) {
  const w = view.w;
  const h = view.h;
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'PAUSED', w / 2, h * 0.34, 44, '#ffffff', 'center', true);
  text(ctx, 'P or Esc resume    M mute    R restart the day', w / 2, h * 0.34 + 34, 15, '#c9d1de', 'center');
  text(ctx, 'Your progress is saved automatically.', w / 2, h * 0.34 + 62, 14, '#8b93a3', 'center');
}

export function drawStoryComplete(ctx, view, game) {
  const w = view.w;
  const h = view.h;
  ctx.fillStyle = 'rgba(8,10,16,0.82)';
  ctx.fillRect(0, 0, w, h);
  text(ctx, 'SOLMAR BAY IS YOURS', w / 2, h * 0.36, 40, '#ffd94a', 'center', true);
  text(ctx, 'All five jobs done. The whole city is talking about Milo Kade.', w / 2, h * 0.36 + 32, 16, '#eef1f5', 'center');
  text(ctx, `Money earned: $${Math.floor(game.stats.earned)}    Cars stolen: ${game.stats.stolen}    Cops dodged: ${game.stats.escapes}`, w / 2, h * 0.36 + 62, 15, '#c9d1de', 'center');
  text(ctx, 'Keep playing — free roam never ends. Press Enter to keep driving.', w / 2, h * 0.36 + 96, 14, '#8b93a3', 'center');
}
