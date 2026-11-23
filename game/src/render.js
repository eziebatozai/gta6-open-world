// Drawing only: the camera, the world and everything in it, the day's light.
// The static city is blitted from its prerendered layer; cars, people, the
// player and effects are drawn over it; the HUD is drawn by hud.js.
import { WORLD } from './config.js';
import { LANDMARKS } from './world.js';
import { drawCar } from './vehicles.js';
import { drawPlayer } from './player.js';
import { drawPedestrians } from './pedestrians.js';
import { drawPolice } from './police.js';
import { drawBullets } from './combat.js';
import { drawEffects } from './effects.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, dpr: 1 };
  const camera = { x: 1800, y: 1300, zoom: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Sun tint by the game clock (minutes since midnight). */
  function dayTint(clock) {
    const hour = (clock / 60) % 24;
    if (hour >= 21 || hour < 5) return { color: 'rgba(16,24,64,0.38)', night: true };
    if (hour >= 17 && hour < 19) return { color: 'rgba(255,140,60,0.14)', night: false };
    if (hour >= 5 && hour < 7) return { color: 'rgba(255,180,90,0.12)', night: false };
    return { color: 'rgba(255,240,200,0.05)', night: false };
  }

  function draw(game) {
    const player = game.player;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const wantZoom = player.car ? 0.8 : 1.0;
    camera.zoom += (wantZoom - camera.zoom) * 0.04;
    camera.x += (px - camera.x) * 0.08;
    camera.y += (py - camera.y) * 0.08;
    const shake = game.effects.shake;
    const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, view.w, view.h);
    const vw = view.w / camera.zoom;
    const vh = view.h / camera.zoom;
    const sx = Math.max(0, Math.min(WORLD.width - vw, camera.x - vw / 2 + shX));
    const sy = Math.max(0, Math.min(WORLD.height - vh, camera.y - vh / 2 + shY));

    ctx.save();
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-(camera.x + shX), -(camera.y + shY));
    game.city.drawStatic(ctx, sx, sy, vw, vh, sx, sy, vw, vh);

    // Cash pickups.
    for (const pick of game.pickups) {
      const bob = Math.sin(game.time * 3 + pick.x) * 2;
      ctx.fillStyle = '#2a7a3f';
      ctx.beginPath();
      ctx.arc(pick.x, pick.y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7ac74f';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pick.x, pick.y + bob + 4);
    }

    // Mission target beacon.
    const target = game.missionTarget;
    if (target) {
      const pulse = 0.6 + Math.sin(game.time * 4) * 0.25;
      ctx.fillStyle = `rgba(255,217,74,${0.18 * pulse})`;
      ctx.fillRect(target.x - 26, target.y - 130, 52, 130);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(target.x, target.y - 12 + Math.sin(game.time * 4) * 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', target.x, target.y - 8 + Math.sin(game.time * 4) * 4);
    }

    // Landmark labels, only near the player so the city stays clean.
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(LANDMARKS)) {
      const mark = LANDMARKS[key];
      const d = Math.hypot(mark.x - px, mark.y - py);
      if (d > 420) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = ctx.measureText(mark.name).width + 12;
      ctx.fillRect(mark.x - tw / 2, mark.y - 46, tw, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(mark.name, mark.x, mark.y - 34);
    }

    // Cars: parked, traffic, police, then the player's.
    for (const car of game.traffic.parked) drawCar(ctx, car, game.time);
    for (const car of game.traffic.moving) drawCar(ctx, car, game.time);
    for (const car of game.police.cars) drawCar(ctx, car, game.time);
    if (player.car) drawCar(ctx, player.car, game.time);

    drawPedestrians(ctx, game.peds, game.time);
    drawPolice(ctx, game.police, game.time);
    drawPlayer(ctx, player, game.time);
    drawBullets(ctx, game.bullets);
    drawEffects(ctx, game.effects);
    ctx.restore();

    // Day and night light, over the world but under the HUD.
    const tint = dayTint(game.clock);
    ctx.fillStyle = tint.color;
    ctx.fillRect(0, 0, view.w, view.h);
    if (tint.night) {
      // A pool of light around the player at night.
      const grad = ctx.createRadialGradient(view.w / 2, view.h / 2, 60, view.w / 2, view.h / 2, 320);
      grad.addColorStop(0, 'rgba(255,220,150,0.10)');
      grad.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  return { ctx, view, camera, draw };
}
