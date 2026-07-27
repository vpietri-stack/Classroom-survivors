# School Defense 3D — three.js POC Design

Date: 2026-07-25 · Status: approved by user · Branch: preview (deploys to Classroom-survivors-preview)

## Goal

Prove that a Tunic-style low-poly 3D action/tower-defense hybrid runs well on the project's
target devices (phones/tablets, WeChat browser) using three.js, self-hosted, with the
existing project's zero-build classic-web architecture untouched.

Fortnite (build walls) × Tower Defense (drop towers) × Tunic (fixed-angle low-poly diorama).

## Approved scope decisions

| Decision | Choice |
|---|---|
| ESL learning loop | NOT in POC — pure gameplay first; ESL bridge wired later (tdStartESL pattern) |
| Controls | Virtual joystick + action buttons (mobile), WASD + keys (desktop) |
| Economy | Enemies drop coins, picked up by walking over them |
| Assets | Kenney CC0 GLB packs self-hosted; procedural-primitive fallback with same interface |
| Session | 5 escalating waves → victory screen; school destroyed → game over |
| Building | Snap-to-grid cells (2×2 units), stand near cell to place |
| Camera | Orthographic 3/4 follow cam, rotatable in 90° steps (Q/E / button) |
| Roster | 3 towers + reinforceable wall, 3 enemy types + wave-5 boss |
| Integration | Approach A: standalone `three_td.html`, nothing in index.html touched |

## Files

```
three_td.html              page shell + DOM HUD overlay (Tailwind-free, plain CSS)
three_td/
  main.js                  bootstrap, game loop, state machine (menu/playing/buildgap/won/lost)
  models.js                model factory: procedural low-poly primitives now, GLB swap later
  world.js                 terrain (hill heightmap), school, spawn gates, build grid, A* pathing
  input.js                 virtual joystick + buttons (touch) / WASD+JKLBQE1-4 (desktop)
  player.js                movement, sword / bow / special combat
  enemies.js               runner / tank / ranged + boss, wave director
  build.js                 wall + 3 towers placement, tower AI, coin drops/pickup
  hud.js                   DOM HUD sync (coins, wave, school HP, arrows, special cooldown)
  vendor/three.module.js   three r170 (self-hosted, no CDN)
  vendor/GLTFLoader.js     for the GLB swap
  assets/                  Kenney GLBs when downloaded
```

ES modules via `<script type="module">` + import map (`"three"` → vendor file).

## World

- 60×60-unit diorama, center (0,0). Smooth hill (cos falloff, height 6, radius 18) with the
  school (blocky building cluster, HP 20) on top. Decorative trees/rocks at edges.
- `terrainHeight(x,z)` places everything; entities walk on the surface.
- 3 spawn gates on map borders: N(0,-28), SW(-24,20), SE(24,20).
- Build grid: 30×30 cells of 2×2 units; buildable ring between radius 5 and 24 from center.
- Pathfinding: A* over the grid. Structures cost 50 (tanks 10) instead of blocking, so
  enemies path "through" but stop and smash the first structure blocking their way — PvZ
  behavior, no unreachable-path edge cases. Recomputed per-enemy on placement changes.

## Camera & look

Orthographic, elevation ~35°, azimuth steps {45°,135°,225°,315°}, smooth tween on rotate,
follows player. Flat shading, DirectionalLight + HemisphereLight, blob shadows (no shadow
maps — WeChat perf), light fog for diorama depth. `pixelRatio = min(dpr, 2)`.

## Player

HP 50, speed 8, joystick-relative-to-camera movement. Death → respawn at school in 5 s.
+10 HP on wave clear.

| Weapon | Numbers |
|---|---|
| Sword | 15 dmg, 120° arc, range 2.8, cd 0.45 s, small knockback |
| Bow | 12 dmg, projectile speed 24, auto-aim nearest in 60° facing cone; 30 arrows start, +10 per wave, tanks drop 5-packs |
| Special | 60 dmg AOE radius 7 + big knockback, 45 s recharge (radial meter on button) |

## Building

Coins: start 40; runner drops 3, ranged 5, tank 8, boss 40. Coin meshes attract-to-player
within 2.5 u.

| Buildable | Cost | Stats |
|---|---|---|
| Wall | 10 | 200 HP; tap again +10 c → +150 HP (reinforced look) |
| Arrow tower | 30 | 8 dmg, range 9, 0.8 s rate, 80 HP |
| Frost tower | 40 | 50% slow pulse, radius 6, 80 HP |
| Cannon tower | 60 | 20 dmg splash r 2.5, range 8, 2 s rate, 80 HP |

Placement: cells within 4 u of player highlight when build bar open; tap cell / press key.

## Enemies & waves

| Type | HP | Speed | vs school | Notes |
|---|---|---|---|---|
| Runner | 25 | 5.5 | 1 dmg | swarms |
| Ranged | 40 | 3.5 | 1 (shoots) | stops at 8 u, shoots player/towers/school (6 dmg) |
| Tank | 120 | 2.2 | 3 dmg | 20 dmg vs structures, prefers smashing walls |
| Boss (w5) | 600 | 1.8 | 5 dmg | big tank variant |

Waves: (1) 6 R · (2) 10 R + 2 T · (3) 12 R + 3 T + 3 G · (4) 16 R + 5 T + 5 G ·
(5) 22 R + 8 T + 8 G + boss. 15 s skippable build gap between waves.

## Controls

Mobile: left joystick; right: Sword / Bow / Special buttons + Build toggle → build bar.
Desktop: WASD move · J sword · K bow · L special · B build bar · 1-4 select · Q/E rotate.

## Out of scope (POC)

ESL minigames, auth/analytics/SR integration, sound, GLB animations, index.html menu entry,
persistence. All follow the proven TD integration patterns once gameplay is validated.

## Verification

Local static server + headless-browser screenshots per iteration; full desktop playthrough
of 5 waves; commit to preview branch; user tests on real phone at
`…/Classroom-survivors-preview/three_td.html`.
