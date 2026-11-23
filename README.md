# Solmar Bay — An Open-World Crime Story

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/eziebatozai/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/eziebatozai/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

Milo Kade is back in Solmar Bay with $120 and a borrowed jacket. Lena Cruz
has work: five jobs, one city, and every cop in town.

## The game

A complete open-world crime game in the browser — no build step, no network,
pure canvas and WebAudio:

- **A city to explore** — Solmar Bay: Downtown towers, Old Town shops, the
  Harbour docks, the Palms suburbs and Sunset Beach, all on foot and by car.
- **Traffic and pedestrians** — cars drive the grid, people stroll the
  sidewalks and flee from trouble.
- **Cars to steal and drive** — parked cars and traffic, arcade handling with
  drifts and skid marks, and a Comet GT to buy at Vic's Garage.
- **A wanted level and police who respond** — 0 to 5 stars; patrol cars chase
  and ram, foot cops chase and bust you. Lose them by breaking line of sight.
- **Missions and a story** — five jobs from Vic, Sofia and Lena: steal a car,
  run the lunch rush, grab the bank cash and lose the cops, move a crate at
  the harbour, and the big score.
- **Combat** — punch and pistol, health and ammo, car explosions.
- **A HUD with a minimap** — wanted stars, health, money, objective, clock,
  district, speed, and a live minimap with police and mission blips.
- **Menus and saving** — title screen, pause, and progress saved to
  localStorage. Sound is synthesized live with WebAudio.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Aim |
| Click | Shoot |
| E | Enter / exit a car |
| F | Punch |
| Shift | Sprint |
| Space | Handbrake |
| N | Start the next job |
| B | Buy the Comet GT at Vic's Garage |
| P / Esc | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Layout

- `game/index.html` — the page and canvas.
- `game/src/config.js` — every tuning number.
- `game/src/world.js` — the city: roads, districts, buildings, collision.
- `game/src/game.js` — the simulation: rules, crimes, busted and wasted.
- `game/src/player.js` — Milo, on foot and in a car.
- `game/src/vehicles.js` — car physics, types and drawing.
- `game/src/traffic.js` — NPC drivers and parked cars.
- `game/src/pedestrians.js` — the people of Solmar Bay.
- `game/src/police.js` — the wanted level and the law.
- `game/src/combat.js` — bullets and punches.
- `game/src/missions.js` — the five jobs and the story.
- `game/src/effects.js` — particles, skid marks, explosions.
- `game/src/audio.js` — synthesized WebAudio sound.
- `game/src/hud.js` — HUD, minimap, dialogue and menus.
- `game/src/render.js` — camera, day and night light.
- `game/src/shots.js` — the four screenshot scenes.
- `game/src/main.js` — boot, loop and screens.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`.
