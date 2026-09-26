# Onion Boy - Project Roadmap & TODO List

## 🎮 Project Scope & Design Decisions
- **Target Platform**: Desktop-first keyboard & mouse controls (`WASD` / `Arrows`, `Space` / `W` to Jump, `Left-Click` / `Left Ctrl` to Shoot, `[E]` to Activate Totem, `[C]` to Respawn at Checkpoint, `Double [R]` or Top-Right button to Restart Run, `[ESC]` or Top-Right button for Pause Menu).
- **Fullscreen Adaptive Scaling**: Dynamic aspect-ratio viewport (`baseHeight = 480`, `width = Math.round(480 * ratio)`) with `Phaser.Scale.FIT` and `CENTER_BOTH` to fill all screen dimensions without black sidebars.
- **Economy**: Defeating enemies (mobs, pipe monsters, shooters) awards Coins (+1 to +3 depending on enemy type).
- **Backend & Web3 Integration**: Direct SurrealDB backend architecture (no intermediate API layer) handling speedrun anti-cheat, session verification, global leaderboards, and whitelist issuance.
- **Always-Equipped Abilities**: No hotbar switching. `Left Click` or `Left Ctrl` shoots Blaster and `[E]` activates Shield Totem directly.
- **Checkpoint Architecture**: Generalized Custom Checkpoints (`Checkpoint1Zone` -> `Checkpoint1`, `Checkpoint2Zone` -> `Checkpoint2`). Dying, pressing `[C]`, or selecting "Respawn at Checkpoint" rolls back state to checkpoint snapshot (respawns items/mobs ahead of checkpoint, keeps prior progress saved).

---

## 📋 Task List

### ✅ Completed
- [x] **Destructible Bridges & Smash Ground Mechanics**:
  - Integrated `new bridge break sprite.png` (96x32) with a 4-frame shattering animation at 6 FPS.
  - Smooth smash fall detection, downward impact velocity resistance, WebAudio crumbling wood sound synthesis, subtle screen shake, and wooden splinter particle effects.
  - Complete checkpoint snapshotting, rollback, and run reset support.
- [x] **Elecking Boss Encounter State Machine & Arena Isolation**:
  - Integrated `Elecking Power Attack Sprite 96.png` with pixel-tight hitbox framing for idle and drum states.
  - Telegraphed 3-drum sequence (randomized e.g. 1-3-5, 3-5-1) with 1s frame display, followed by `Elecking Powerup 96.png` powerup sequence before vanishing.
  - Timed vanishing phase (3-4s) followed by sequential thunder strikes raining down onto mapped `dotNumber` ground tiles.
  - Phase 2 grounded patrol with player pursuit, Orbs of Rage firing, and minion summoning.
  - Moving `TemporaryCloud` platform evasion with stand duration, step fading (3 -> 2 -> 1 -> 0), and respawn cycles.
  - `BossArenaZone` cover tile sprite occlusion (`plainGround.png`) outside arena, unfreezing boss and moving platforms upon crossing `BossFightEntrance`.
  - Arena state persistence on death inside the arena, with clean full reset on run restart or checkpoint rollback.
- [x] **Lava Kappa & Mob AI Line-of-Sight (LOS) System**:
  - Player detection and follow behavior within detection range.
  - Fireball shooting with exact player-facing direction and mouth offset coordinates.
  - Raycasted Line-of-Sight (LOS) checking ground tiles, smash blocks, destructible bridges, and moving platforms: when LOS is obstructed, mobs ignore hidden players and smoothly continue their regular patrol path.
  - Strict `standStill: true` / stationary behavior: stays fixed in place without walking animations, turning only when the player is in visible line of sight.
- [x] **Static In-World Door Prompt**: Fixed stationary "Press E To Enter" badge anchored directly above teleporter door entrances.
- [x] **New Jump Pad Asset & Mechanics**: Added spring / jump pad asset with physics bounce trajectory, 4-frame animation, and pixel-accurate 8px bottom hitbox.
- [x] **Simple Death Effect**: Directional left/right player elimination death animation sequences using `simple death sprite.png` (`simple-death-l-anim` & `simple-death-r-anim`) with particle bursts.
- [x] **Electric Death Effect**: Directional left/right electric shock / thunder strike death animation sequences using `electric death sprite.png` (`electric-death-l-anim` & `electric-death-r-anim`).
- [x] **Active Gameplay Run Timer**: Accurate delta-based run timer (`activeRunTimeMs`) that strictly accumulates during active gameplay and pauses seamlessly during death animations, checkpoint respawns, and pause menus.
- [x] **New Custom Mobs (Lantern Spirit & Shapeshifter Fox)**:
  - Added `Lantern-Spirit-L.png` & generated pixel-flipped `Lantern-Spirit-R.png` (96x32, 3 frames).
  - Added `Shapeshifter-Fox-L.png` & generated pixel-flipped `Shapeshifter-Fox-R.png` (128x32, 4 frames).
  - Added Tiled custom property & name support (`type: "lantern-spirit"` / `"shapeshifter-fox"`, `LanternSpirit` / `ShapeshifterFox`).
  - Removed all deprecated `devil`, `bug`, and `hedgehog` sprites, preloads, and animations.
  - Converted `PipeMonster` to use `mob-bonsai-gripper` (carnivorous plant) to prevent missing texture references.
- [x] **Responsive Fullscreen Viewport Scaling**:
  - Implemented dynamic aspect-ratio viewport expansion in `src/main.ts` locking vertical height to 15 tiles (480px) while dynamically expanding horizontal width to fill widescreen displays without black pillarboxes.
  - Converted HUD elements, modals, floating notifications, and pause overlays in `UIManager.ts` and `InventoryManager.ts` to dynamic screen-relative coordinate getters (`scale.width`, `scale.height`).
- [x] **Direct SurrealDB Backend & Database Architecture**:
  - Modular SurrealQL schemas in `src/db/` (`init.surql`, `tables/*.surql`, `functions/*.surql`).
  - Implemented server-side functions: `fn::start_run`, `fn::submit_run` (anti-cheat speed verification, ranking, whitelist allocation), and `fn::get_leaderboard`.
  - Configured `development` namespace/database with `OVERWRITE` definitions for rapid local iteration.
  - Client-side direct SDK service (`SurrealService.ts`) with offline graceful fallback and Web3 wallet sign-in support.
- [x] **Docker Compose Full-Stack Orchestration**:
  - Configured `Dockerfile` (Node 20 Alpine) and `docker-compose.yml` to boot SurrealDB, execute schema migrations, and serve the Vite frontend with a single command (`docker compose up`).
- [x] **Deterministic Keystroke Input Recorder**:
  - Client-side zero-GC frame ring buffer (`InputRecorder.ts`) recording player keystrokes at 60 ticks/sec for backend anti-cheat re-simulation.
- [x] **Transparent Jump Mechanics Guide at Start**: Added subtle, semi-transparent in-world tutorial description near spawn explaining jump controls (`[SPACE]` / `[W]` / `[↑]`) and variable jump height mechanics (Tap for Short-Hop, Hold for High Jump).
- [x] **Mobile Device Access Guard & Restriction**: Added mobile device / touchscreen detection with a modern retro-styled desktop-only restriction overlay.
- [x] **`[C]` Keybind for Quick Checkpoint Respawn**: Added instant reset to active checkpoint when pressing `C` (shows fallback feedback if no checkpoint is active yet).
- [x] **Top-Right `[R+R] Restart Run` & `[ESC] Menu` HUD Buttons**: Added quick mouse-clickable buttons for instant run restart and pause menu toggling with custom hover styling.
- [x] **`Double [R]` Keybind for Instant Run Restart**: Added double-tap confirmation on `R` key with on-screen prompt (`PRESS [R] AGAIN TO RESTART`) to prevent accidental run loss.
- [x] **Controls Rebinding (`Space` Jump & `Left-Click` / `Left Ctrl` Shoot)**: `Space`, `W`, and `Up Arrow` trigger Jump (with variable jump height), while `Left Click` and `Left Ctrl` fire the Blaster Gun.
- [x] **Disable Physics Debugging**: Turned off `debug: false` in `src/main.ts`.
- [x] **Dynamic Checkpoint Pause Menu Option**: "Respawn at Checkpoint" now conditionally appears only when a checkpoint is achieved; renamed full run reset button to "Restart Full Run".
- [x] **Pause Menu Checkpoint Respawn Option**: Added dedicated "Respawn at Checkpoint" button in the `ESC` pause menu with screen-space mouse hit-testing.
- [x] **Silent Unarmed Input Handling**: Pressing `[Space]` without a blaster or `[E]` without a totem now silently does nothing (no popups/distractions).
- [x] **Readable Checkpoint Notification**: Extended checkpoint saved banner duration to 2500ms with a gentle pop-in and smooth fade-out.
- [x] **Checkpoint Snapshot & Section Rollback**: Checkpoint activation saves a state snapshot. Dying respawns Melissa at the active checkpoint, keeps all progress achieved *before* the checkpoint intact, and cleanly respawns only items, powerups, and enemies located *ahead* of the checkpoint.
- [x] **Input Release / Key Lift on Respawn**: Reset and require key lift (re-press) for all movement/jump keys (`WASD`, `Arrow Keys`, `Left Click`) upon death respawn or run restart to prevent buffered/held inputs from instantly triggering unintended actions.
- [x] **Always-Equipped Direct Abilities (`[L-Click]` & `[E]`)**: Removed hotbar slot switching. `[L-Click]` fires blaster directly, `[E]` activates shield totem directly, supported by a clean dual equipment status HUD.
- [x] **Pipe Monster Piranha Plant Proximity**: Monsters stay hidden inside pipes when the player is standing on or hovering over them, with fast pop speeds and natural randomized intervals.
- [x] **Generalized Multi-Checkpoint System (`Checkpoint1`, `Checkpoint2`, etc.)**: Support custom Trigger Zones (`Checkpoint1Zone`, `Checkpoint2Zone`) and target Spawn Points (`Checkpoint1`, `Checkpoint2`) in Tiled with fanfare celebrations, screen flash, audio chimes, and death respawning.
- [x] **Fake Ground & Illusory Walls (`FakeGround`)**: Support `FakeGround` objects in Tiled filled seamlessly with repeating `plainGround.png`.
- [x] **Moving Platforms with Precision Direction & Bounds**: Configurable `direction` (`left` / `right`) and travel `distance` starting strictly from placement coordinates.
- [x] **Environmental Wind Zones (Air Currents & Turbulence)**: Directional forces (`forceX`, `forceY`), crosswind `turbulence`, and vector particle flow modifying jump physics.
- [x] **Ranged / Shooting Mobs**: Stationary turrets, distance-scaled bullet speed, custom warmup delays, Line-of-Sight raycasts, and zone-based wallhacks (`IgnoreLOSZone`).
- [x] **Dual Controls (WASD & Arrow Keys)**: Full movement and jump support using both `WASD` and `Arrow Keys`.
- [x] **Interactive `ESC` Pause Menu**: Keyboard and mouse navigation with Resume, Restart Run, and Sound Toggle.
- [x] **Accidental Reload Guard**: `beforeunload` browser protection against accidental speedrun loss.
- [x] **Ground Blocks & Stage Tilesets Overhaul**:
  - Preloaded and mapped new ground tilesets: `DIRT AND GRASS REMADE.png`, `cb template.png`, `grass template.png`, `cherry blossom blocks.png`, and `cherry blossom tree.png`.
  - Refactored `MainStageScene` and `EnvironmentManager` to resolve all new tile GIDs seamlessly.
- [x] **Dynamic JSON-Driven Tilemap Layer Stack**:
  - Dynamically iterates over all tile layers in `map.layers` in their exact Tiled layer stack order.
  - Automatically calculates order-aware rendering depths relative to ground and reads custom Tiled depth properties (`depth`, `zindex`, `layerdepth`).
- [x] **Mountain Parallax & Atmospheric Perspective Background**:
  - Configured `0.3x` horizontal parallax scrolling with vertical locking (`1.0x`) for distant depth.
  - Implemented dynamic atmospheric perspective pixel processing (25% desaturation, 15% contrast reduction, 20% sky-tone shift, 100% opacity retained).
- [x] **Animated Looping Molten Lava (`new lava.png`)**:
  - Integrated 64x64 4-tile spritesheet (Row 1: Surface frames, Row 2: Block body frames).
  - Built synchronized 300ms tile swap loop with per-tile initial phase preservation (Frame 1 <-> Frame 2).
  - Integrated `new lava` hazard detection with custom player sinking lava death animation.
- [x] **PipeMonster Custom Scale Property**:
  - Added support for `scale` / `scalePercent` / `size` in Tiled (e.g. `100`, `80`, `150`) with auto-scaling collision box, resting pipe depth, and player proximity detection.
- [x] **Air / Flying Mobs (`FlyingMob`)**: Configurable aerial patrol hazards with tile-based `distance` (1 = 1 tile / 32px), `axis` (`horizontal` / `vertical`), directional flight animations, stomping, blaster elimination, and optional shooting.
- [x] **All Orbs Assets & Mechanics (Gravity Orbs, Orbs of Rage, Victory Orb)**:
  - Integrated dedicated 128x32 animated 4-frame spritesheets (`attack orb.png`, `gravity orb.png`, `victory orb.png`).
  - Implemented 10-collectible Gravity Orbs system to ground and trigger Phase 2 vulnerability for Elecking Boss.
  - Implemented Orbs of Rage boss projectile firing during Phase 2 ground patrol.
  - Implemented Orb of Victory spawning upon boss defeat with fanfare, portal emergence, and SurrealDB stage clear completion.
- [x] **New Teleport Door (`door.png`)**:
  - Added teleporter door asset (`door.png`) rendered on the ground with in-world static `[ E ]` prompt badge anchored above entrances.
  - Integrated exit destination targeting (`doorExitX`, `doorExitY`), screen flash / cyan particle bursts, and seamless player repositioning.
- [x] **Stage Obstacles & Hazards Suite**:
  - Integrated `spike` obstacles with inner bounding box collision to prevent subpixel clipping.
  - Implemented rotating 4-fireball `firebar-sprite` obstacles with custom angle velocity and radius.
  - Added `new lava` molten animated hazards, `jumppad sprite` spring bounce mechanics, and destructible shattering wooden bridges.
  - Implemented environmental wind force currents with vector particle flows.
- [x] **Multi-Layer Parallax Background & Ambient Atmosphere**:
  - Calibrated multi-layer depth & parallax scrolling: Sky (0.05x), Mountain (0.3x), Background (0.55x), Trees (0.75x), and Foreground (1.0x).
  - Preloaded and mapped all stage scenery tilesets: Japanese Pagodas / Buildings (`japanese building`, `japanese_building_3`), Cherry Blossoms (`cherry blossom 2`, `cherry blossom 3`), Diverse Trees (`tree 1..4`), Flower Bushes, and Wells.
  - Added atmospheric perspective color processing and ambient floating cherry blossom petal breeze particles in the background.

---

### ⏳ Active Development & Asset Pipeline
- [ ] **1. Complete Boss Fight & Minions**:
  - Add skeleton bomb minion mob spawned by Elecking Boss on the ground during battle (max 2 waves per fight).
  - Polish Phase 1 cloud lightning/charge attacks and Phase 2 ground orb barrage/vulnerability windows.
  - Finalize boss defeat transition, Victory Orb fanfare, and portal stage completion.
- [x] **3. New Teleport Door**: Add new door asset and interaction logic for teleportation / level transitions.
- [x] **4. New Checkpoint Asset**: Placed `checkpoint sprite.png` from `misc` on the ground at Checkpoint 1, 2, 3, and 4 locations with interactive activation tweens.
- [x] **7. New Obstacles**: Implement new environmental hazards and platforming obstacles across the stage.
- [x] **8. New Bullet Sprite**: Integrated `new bullet sprite.png` (64x64) with directional animations (row 1 left frames 0-1, row 2 right frames 2-3) and updated collision box.
- [ ] **9. Redesign Stage Below First Smash Ground**: Overhaul and rebalance the level design in the lower stage section beneath the first smash ground.
- [ ] **10. Totem Respawn Animation**: Add dedicated activation and revival animation sequence for the Totem of Undying.
- [ ] **11. Gun Movement Effects (Walking & Falling)**: Add specialized walking and airborne/falling animation frames while holding the Blaster Gun.
- [ ] **12. Multi-Layer Background Parallax**: Implement seamless layered parallax scrolling for all background scenery assets and skyboxes without tile detachment.
- [ ] **13. Performance Optimization (Eliminate Stuttering)**: Optimize tile rendering, particle emitters, texture filtering, and update loops to ensure silky smooth 60+ FPS without frame drops.
- [ ] **14. UI Polish & Visual Glassmorphism**:
  - Modernize HUD design with crisp retro glassmorphism, responsive status bars, and vibrant equipment status cards.
  - Refine pause menu and overlay layouts, improving button hover effects, typography, and spacing.
  - Add micro-animations and smooth transition effects for banners (checkpoint notifications, respawn alerts, timer cues).
- [ ] **15. Cloudflare Turnstile Verification Widget**: Add free Turnstile bot protection widget to start-run UI and validate Turnstile tokens in `SurrealService.startRun()`.
- [ ] **16. Web3 Wallet Connection (EIP-712 / SIWE)**: Connect browser wallet (MetaMask, Phantom, Wagmi) to authenticate sessions and sign run verification proofs.

---

### 🚀 Production & Mainnet Launch Checklist (Before Going Live)
- [ ] **Switch SurrealQL from `OVERWRITE` to `IF NOT EXISTS`**: In `src/db/init.surql`, `src/db/tables/*.surql`, and `src/db/functions/*.surql`, change all `OVERWRITE` keywords back to `IF NOT EXISTS`.
- [ ] **Switch Database Name from `development` to `production`**: Update `USE DB development;` to `USE DB production;` in `init.surql`, `docker-compose.yml`, and `SurrealService.ts`.
- [ ] **Configure Cloudflare Turnstile Live Keys**: Set production Turnstile Site Key & Secret Key in environment variables for bot protection on run start.
- [ ] **Configure Production SurrealDB Cloud / VPS Connection**: Provide production `VITE_SURREAL_URL`, credentials, and SSL/WSS certificates.

---

### 🎨 Gameplay Polish & World Expansion
- [ ] **Fix Grey Lines & Edge Bleeding on Sprites**: Thoroughly audit and clean all sprite sheets, tile boundaries, texture bleed margins, and camera subpixel rounding to eliminate grey lines appearing on top of sprites.
- [ ] **Map Expansion & Level 2**: Connect stage doors to secondary map sections or next level.
- [ ] **Audio Assets**: Replace synthesized audio oscillator tones with dedicated sound effects and background music tracks.


