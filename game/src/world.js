// Solmar Bay — the city. A seeded road grid with four districts, buildings,
// parks, a harbour and a bay; a static layer prerendered once to an offscreen
// canvas; collision helpers for circles (players, cars, pedestrians).
import { WORLD, ROADS_X, ROADS_Y, DISTRICTS } from './config.js';

const HALF_ROAD = WORLD.roadWidth / 2;
const SIDEWALK = WORLD.sidewalk;

// The bay: open water along the east edge. Nothing may drive or walk there.
export const WATER = { x0: 3480, y0: 0, x1: 3600, y1: 2600 };

// Named places missions and the HUD point at. x/y sit on a road, next to a door.
export const LANDMARKS = {
  garage: { id: 'garage', name: "Vic's Garage", x: 700, y: 1150, color: '#f2a541' },
  diner: { id: 'diner', name: "Sofia's Diner", x: 1200, y: 650, color: '#ff7a7a' },
  bank: { id: 'bank', name: 'Solmar Trust Bank', x: 1700, y: 1150, color: '#7ac74f' },
  hospital: { id: 'hospital', name: 'St. Marina Hospital', x: 2200, y: 650, color: '#ffffff' },
  policeHQ: { id: 'policeHQ', name: 'Solmar PD HQ', x: 1700, y: 1750, color: '#6ea8ff' },
  safehouse: { id: 'safehouse', name: 'Safehouse', x: 1200, y: 2250, color: '#ffd94a' },
  warehouse: { id: 'warehouse', name: 'Harbour Warehouse', x: 3200, y: 1150, color: '#c98f5f' },
  dock: { id: 'dock', name: 'Harbour Dock', x: 3380, y: 1750, color: '#5fc4c9' },
  beach: { id: 'beach', name: 'Sunset Beach', x: 3350, y: 650, color: '#ffe9a8' },
};

const DOWNTOWN_COLORS = ['#3a4a63', '#46587a', '#2f3d55', '#54698c', '#3d526e'];
const OLDTOWN_COLORS = ['#a8623f', '#b5764a', '#96522f', '#c08a54', '#8a5a38'];
const HARBOUR_COLORS = ['#6e6a63', '#7d7468', '#5d6157', '#8a7f6a'];
const SUBURB_COLORS = ['#d9a066', '#c98f7a', '#a8b878', '#7fa3b8', '#d4b56a'];
const ROOF_COLORS = ['#2c3550', '#4a3b2c', '#37424e', '#5b4a35'];

function districtAt(x, y) {
  if (x >= DISTRICTS.harbour.x0) return 'harbour';
  if (x >= DISTRICTS.downtown.x0 && x <= DISTRICTS.downtown.x1 && y >= DISTRICTS.downtown.y0 && y <= DISTRICTS.downtown.y1) return 'downtown';
  if (y >= DISTRICTS.suburbs.y0) return 'suburbs';
  return 'oldTown';
}

function paletteFor(district) {
  if (district === 'downtown') return DOWNTOWN_COLORS;
  if (district === 'harbour') return HARBOUR_COLORS;
  if (district === 'suburbs') return SUBURB_COLORS;
  return OLDTOWN_COLORS;
}

function blockRect(ix, iy) {
  const x0 = ROADS_X[ix] + HALF_ROAD + SIDEWALK;
  const x1 = ROADS_X[ix + 1] - HALF_ROAD - SIDEWALK;
  const y0 = ROADS_Y[iy] + HALF_ROAD + SIDEWALK;
  const y1 = ROADS_Y[iy + 1] - HALF_ROAD - SIDEWALK;
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/** Build every building, park and tree of the city from a seeded random. */
function buildCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const block = blockRect(ix, iy);
      if (block.w < 60 || block.h < 60) continue;
      const cx = (block.x0 + block.x1) / 2;
      const cy = (block.y0 + block.y1) / 2;
      const district = districtAt(cx, cy);
      // The harbour's eastern blocks are docks and container yards, not offices.
      if (district === 'harbour' && cx > 3050) {
        if (random.chance(0.55)) {
          for (let k = 0; k < 5; k += 1) {
            const w = random.range(60, 120);
            const h = random.range(26, 34);
            buildings.push({
              x: block.x0 + 20 + random.range(0, Math.max(1, block.w - w - 40)),
              y: block.y0 + 16 + k * 52,
              w, h,
              color: random.pick(['#c65f3d', '#3d7ac6', '#7ac65f', '#c6a43d', '#8a5fc6']),
              height: 1, roof: '#33302a', district,
            });
          }
          continue;
        }
      }
      if (random.chance(0.16)) {
        parks.push({ x0: block.x0, y0: block.y0, x1: block.x1, y1: block.y1 });
        const count = Math.floor(random.range(4, 9));
        for (let k = 0; k < count; k += 1) {
          trees.push({ x: random.range(block.x0 + 24, block.x1 - 24), y: random.range(block.y0 + 24, block.y1 - 24), r: random.range(10, 16) });
        }
        continue;
      }
      const palette = paletteFor(district);
      if (district === 'downtown') {
        // One or two towers per block.
        const towers = random.chance(0.5) ? 1 : 2;
        for (let k = 0; k < towers; k += 1) {
          const w = random.range(110, Math.min(190, block.w - 40));
          const h = random.range(110, Math.min(190, block.h - 40));
          buildings.push({
            x: block.x0 + 20 + (towers === 1 ? (block.w - w) / 2 : k * (block.w - w - 40)),
            y: block.y0 + 20 + (block.h - h) / 2,
            w, h,
            color: random.pick(palette),
            height: random.int(2, 4),
            roof: random.pick(ROOF_COLORS), district,
          });
        }
      } else if (district === 'suburbs') {
        // Small houses with lawns.
        const cols = 2;
        const rows = 2;
        for (let gx = 0; gx < cols; gx += 1) {
          for (let gy = 0; gy < rows; gy += 1) {
            if (!random.chance(0.85)) continue;
            const w = random.range(56, 84);
            const h = random.range(48, 70);
            buildings.push({
              x: block.x0 + 18 + gx * ((block.w - 36) / cols) + random.range(0, 20),
              y: block.y0 + 18 + gy * ((block.h - 36) / rows) + random.range(0, 16),
              w, h,
              color: random.pick(palette),
              height: 1, roof: random.pick(['#8a4a3a', '#5a6a7a', '#7a6a4a']), district,
            });
            trees.push({ x: block.x0 + 30 + gx * ((block.w - 36) / cols), y: block.y0 + 30 + gy * ((block.h - 36) / rows), r: 9 });
          }
        }
      } else {
        // Shops and warehouses: two to four per block.
        const count = random.int(2, 4);
        for (let k = 0; k < count; k += 1) {
          const w = random.range(70, 130);
          const h = random.range(50, 90);
          buildings.push({
            x: block.x0 + 14 + random.range(0, Math.max(1, block.w - w - 28)),
            y: block.y0 + 14 + random.range(0, Math.max(1, block.h - h - 28)),
            w, h,
            color: random.pick(palette),
            height: random.int(1, 2),
            roof: random.pick(ROOF_COLORS), district,
          });
        }
      }
    }
  }
  return { buildings, parks, trees };
}

function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= HALF_ROAD) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= HALF_ROAD) return true;
  return false;
}

export function createCity(random) {
  const { buildings, parks, trees } = buildCity(random);

  function buildingAt(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  /** Push a circle out of buildings, water and the world edge. Returns corrected {x, y}. */
  function resolveCircle(x, y, r) {
    let nx = Math.max(r, Math.min(WORLD.width - r, x));
    let ny = Math.max(r, Math.min(WORLD.height - r, y));
    // Water blocks movement.
    if (nx + r > WATER.x0 && ny > WATER.y0 && ny < WATER.y1) nx = WATER.x0 - r;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          ny = cy + (dy / d) * r;
        } else {
          // Centre inside the rect: push out along the smallest overlap.
          const left = nx - b.x;
          const right = b.x + b.w - nx;
          const top = ny - b.y;
          const bottom = b.y + b.h - ny;
          const m = Math.min(left, right, top, bottom);
          if (m === left) nx = b.x - r;
          else if (m === right) nx = b.x + b.w + r;
          else if (m === top) ny = b.y - r;
          else ny = b.y + b.h + r;
        }
      }
    }
    return { x: nx, y: ny };
  }

  function hitsBuilding(x, y, r) {
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  function randomRoadPoint() {
    if (random.chance(0.5)) {
      const rx = random.pick(ROADS_X);
      return { x: rx + random.range(-HALF_ROAD + 14, HALF_ROAD - 14), y: random.range(80, WORLD.height - 80) };
    }
    const ry = random.pick(ROADS_Y);
    return { x: random.range(80, WORLD.width - 80), y: ry + random.range(-HALF_ROAD + 14, HALF_ROAD - 14) };
  }

  function randomIntersection() {
    return { x: random.pick(ROADS_X), y: random.pick(ROADS_Y) };
  }

  /** Snap a point to the nearest road centre line. */
  function nearestRoadPoint(x, y) {
    let bestX = ROADS_X[0];
    let bestD = Infinity;
    for (const rx of ROADS_X) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; bestX = rx; }
    }
    let bestY = ROADS_Y[0];
    bestD = Infinity;
    for (const ry of ROADS_Y) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; bestY = ry; }
    }
    return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
  }

  /** A point on a sidewalk beside a road, for pedestrians. */
  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    let best = null;
    let bestD = Infinity;
    for (const rx of ROADS_X) {
      const d = Math.abs(p.x - rx);
      if (d < bestD) { bestD = d; best = { axis: 'x', at: rx, off: HALF_ROAD + SIDEWALK / 2 }; }
    }
    for (const ry of ROADS_Y) {
      const d = Math.abs(p.y - ry);
      if (d < bestD) { bestD = d; best = { axis: 'y', at: ry, off: HALF_ROAD + SIDEWALK / 2 }; }
    }
    if (best.axis === 'x') return { x: best.at + (random.chance(0.5) ? best.off : -best.off), y: p.y };
    return { x: p.x, y: best.at + (random.chance(0.5) ? best.off : -best.off) };
  }

  // ---- Static layer: prerendered once, blitted every frame. ----
  const layer = document.createElement('canvas');
  layer.width = WORLD.width;
  layer.height = WORLD.height;
  const g = layer.getContext('2d');

  function paintStatic() {
    // Ground: grass under everything.
    g.fillStyle = '#9aa86b';
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach sand along the bay.
    g.fillStyle = '#e8d9a8';
    g.fillRect(3400, 0, 80, WORLD.height);
    // The bay.
    g.fillStyle = '#2f7fb8';
    g.fillRect(WATER.x0, WATER.y0, WATER.x1 - WATER.x0, WATER.y1 - WATER.y0);
    g.fillStyle = '#3f97cc';
    for (let y = 40; y < WORLD.height; y += 120) {
      g.fillRect(WATER.x0 + 12, y, 60, 3);
      g.fillRect(WATER.x0 + 40, y + 60, 50, 3);
    }
    // Parks.
    for (const p of parks) {
      g.fillStyle = '#7ba05b';
      g.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      g.fillStyle = '#8fb36a';
      g.fillRect(p.x0 + 12, p.y0 + 12, p.x1 - p.x0 - 24, p.y1 - p.y0 - 24);
    }
    // Sidewalks: pale strips along every road.
    g.fillStyle = '#c9c2b2';
    for (const rx of ROADS_X) g.fillRect(rx - HALF_ROAD - SIDEWALK, 0, WORLD.roadWidth + SIDEWALK * 2, WORLD.height);
    for (const ry of ROADS_Y) g.fillRect(0, ry - HALF_ROAD - SIDEWALK, WORLD.width, WORLD.roadWidth + SIDEWALK * 2);
    // Roads.
    g.fillStyle = '#3c3f45';
    for (const rx of ROADS_X) g.fillRect(rx - HALF_ROAD, 0, WORLD.roadWidth, WORLD.height);
    for (const ry of ROADS_Y) g.fillRect(0, ry - HALF_ROAD, WORLD.width, WORLD.roadWidth);
    // Centre dashes.
    g.fillStyle = '#d8c94a';
    for (const rx of ROADS_X) {
      for (let y = 20; y < WORLD.height; y += 64) g.fillRect(rx - 2, y, 4, 32);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 64) g.fillRect(x, ry - 2, 32, 4);
    }
    // Crosswalks at intersections.
    g.fillStyle = '#e8e6da';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let k = -3; k <= 3; k += 1) {
          g.fillRect(rx - HALF_ROAD + 6, ry + k * 12 - 4, 12, 6);
          g.fillRect(rx + HALF_ROAD - 18, ry + k * 12 - 4, 12, 6);
          g.fillRect(rx + k * 12 - 4, ry - HALF_ROAD + 6, 6, 12);
          g.fillRect(rx + k * 12 - 4, ry + HALF_ROAD - 18, 6, 12);
        }
      }
    }
    // Harbour pier.
    g.fillStyle = '#8a7a5a';
    g.fillRect(3400, 1680, 80, 140);
    g.fillStyle = '#6e5f45';
    for (let k = 0; k < 8; k += 1) g.fillRect(3404, 1686 + k * 17, 72, 4);
    // Trees.
    for (const t of trees) {
      g.fillStyle = '#2f6b2f';
      g.beginPath();
      g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#4a8a3f';
      g.beginPath();
      g.arc(t.x - 2, t.y - 2, t.r * 0.65, 0, Math.PI * 2);
      g.fill();
    }
    // Buildings: shadow, wall, roof, sunlit edge, windows on tall ones.
    for (const b of buildings) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(b.x + 4, b.y + 6, b.w, b.h);
      g.fillStyle = b.color;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = b.roof;
      g.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(b.x + 5, b.y + 5, b.w - 10, 8);
      if (b.height >= 2) {
        g.fillStyle = 'rgba(180,220,255,0.5)';
        for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 22) {
          for (let wy = b.y + 16; wy < b.y + b.h - 12; wy += 24) g.fillRect(wx, wy, 10, 12);
        }
      }
    }
  }
  paintStatic();

  return {
    buildings, parks, trees,
    buildingAt, resolveCircle, hitsBuilding, onRoad,
    randomRoadPoint, randomIntersection, nearestRoadPoint, randomSidewalkPoint,
    districtAt,
    /** Blit the visible slice of the prerendered city. */
    drawStatic(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
      ctx.drawImage(layer, sx, sy, sw, sh, dx, dy, dw, dh);
    },
    layer,
  };
}
