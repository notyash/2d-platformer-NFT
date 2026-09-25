# Onion Boy - Project Roadmap & TODO List

## 🎮 Project Scope & Design Decisions
- **Target Platform**: Desktop-first keyboard & mouse controls (`WASD` / `Arrows`, `Space` / `W` to Jump, `Left-Click` / `Left Ctrl` to Shoot, `[E]` to Activate Totem, `[C]` to Respawn at Checkpoint, `Double [R]` or Top-Right button to Restart Run, `[ESC]` or Top-Right button for Pause Menu).
- **Boss Encounter**: Optional single mini-boss encounter at the end of the stage.
- **Economy**: Defeating enemies (mobs, pipe monsters, shooters) awards +1 Coin.
- **Backend & Web3 Integration**: Runs communicate with Rust/PostgreSQL backend for secure leaderboard logging, whitelist qualification, and anti-cheat verification.
- **Always-Equipped Abilities**: No hotbar switching. `Left Click` or `Left Ctrl` shoots Blaster and `[E]` activates Shield Totem directly.
- **Checkpoint Architecture**: Generalized Custom Checkpoints (`Checkpoint1Zone` -> `Checkpoint1`, `Checkpoint2Zone` -> `Checkpoint2`). Dying, pressing `[C]`, or selecting "Respawn at Checkpoint" rolls back state to checkpoint snapshot (respawns items/mobs ahead of checkpoint, keeps prior progress saved).

---

## 📋 Task List

### ✅ Completed
- [x] **Static "Press E To Enter" Door Prompt**: Made the door interaction prompt stationary above the entrance rather than floating dynamically with player coordinates.
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
- [x] **Air / Flying Mobs (`FlyingMob`)**: Configurable aerial patrol hazards with tile-based `distance` (1 = 1 tile / 32px), `axis` (`horizontal` / `vertical`), directional flight animations, stomping, blaster elimination, and optional shooting.
- [x] **Retro 8-Bit SFX Engine**: Native WebAudio synthesis for Jump, Shoot, Enemy Shoot, Coin, Powerup, Stomp, Death, and UI clicks.

---

### ⏳ Active Development & Asset Pipeline
- [ ] **1. Replace 2 Old Mobs**: Swap out 2 old mobs from the free asset pack with new designated mob sprites.
- [ ] **2. Skeleton Bomb Minion Mob**: Add skeleton bomb mob as the summonable minion that the Elecking Boss spawns on the ground (max 2 waves per fight).
- [ ] **3. New Teleport Door**: Add new door asset and interaction logic for teleportation / level transitions.
- [ ] **4. New Checkpoint Asset**: Replace/upgrade the checkpoint banner and visual pole/flag assets.
- [ ] **5. Bridge Smash Ground Asset**: Add bridge sprite as the new destructible / smash ground asset.
- [ ] **6. New Obstacles**: Implement new environmental hazards and platforming obstacles across the stage.
- [ ] **7. New Bullet Sprite**: Upgrade the blaster projectile sprite and impact animations.
- [ ] **8. All Orbs Assets**: Integrate dedicated sprites for all boss fight orbs (Gravity Orbs, Orbs of Rage, and Orb of Victory).
- [ ] **9. Redesign Stage Below First Smash Ground**: Overhaul and rebalance the level design in the lower stage section beneath the first smash ground.
- [ ] **10. Totem Respawn Animation**: Add dedicated activation and revival animation sequence for the Totem of Undying.
- [ ] **11. Simple Death Effect**: Implement standard player elimination visual FX and particle burst.
- [ ] **12. Electric Death Effect**: Implement electric shock / thunder strike death animation and effects (`cloud attack1.png` - `cloud attack5.png`).
- [ ] **13. Gun Movement Effects (Walking & Falling)**: Add specialized walking and airborne/falling animation frames while holding the Blaster Gun.
- [ ] **14. New Jump Pad Asset & Mechanics**: Add spring / jump pad asset with physics bounce trajectory.
- [ ] **15. Improve Background**: Enhance multi-layer parallax backgrounds, atmospheric lighting, and world depth.
- [ ] **16. UI Polish & Visual Glassmorphism**:
  - Modernize HUD design with crisp retro glassmorphism, responsive status bars, and vibrant equipment status cards.
  - Refine pause menu and overlay layouts, improving button hover effects, typography, and spacing.
  - Add micro-animations and smooth transition effects for banners (checkpoint notifications, respawn alerts, timer cues).

---

### 👾 Boss Encounter (Elecking)
- [ ] **Elecking Boss State Machine & Logic**:
  - Ground & Air hovering behavior (instant player death on physical contact).
  - Gravity Orbs mechanics to ground the boss.
  - Patterned Thunder/Lightning attack with vanishing boss phase and strikable ground tiles (`dotNumber`).
  - Orbs of Rage projectile attacks while grounded.
  - Temporary Cloud Platforms appearing/disappearing for vertical evasion.
  - Skeleton Bomb mob summon at 35 HP and 15 HP thresholds (50 total HP).
  - Orb of Victory spawn upon boss defeat.

---

### 🌐 Backend, SurrealDB & Anti-Cheat System
- [x] **SurrealDB Backend & Database Layer**: Native SurrealQL tables (`player`, `run_session`, `leaderboard`, `whitelist`) and backend business functions (`fn::start_run`, `fn::submit_run`, `fn::get_leaderboard`).
- [x] **Modular DB Architecture**: Abstracted into clean modular files in `src/db/` (`init.surql`, `tables/*.surql`, `functions/*.surql`, `access/*.surql`).
- [x] **Docker Compose Orchestration**: Single-command bootup (`docker compose up`) for SurrealDB engine, auto-migration service, and Vite frontend.
- [x] **Deterministic Keystroke Input Recorder**: Client-side zero-GC frame input logger (`InputRecorder.ts`) recording inputs for backend anti-cheat verification.
- [x] **Direct SurrealDB Client Service**: Direct WebSocket/HTTP connection via official SDK (`SurrealService.ts`) with Web3 wallet record auth (`signinWithWallet`).

---

### 🚀 Production & Mainnet Launch Checklist (Before Going Live)
- [ ] **Switch SurrealQL from `OVERWRITE` to `IF NOT EXISTS`**: In `src/db/init.surql`, `src/db/tables/*.surql`, and `src/db/functions/*.surql`, change all `OVERWRITE` keywords back to `IF NOT EXISTS`.
- [ ] **Switch Database Name from `development` to `production`**: Update `USE DB development;` to `USE DB production;` in `init.surql`, `docker-compose.yml`, and `SurrealService.ts`.
- [ ] **Configure Cloudflare Turnstile Live Keys**: Set production Turnstile Site Key & Secret Key in environment variables for bot protection on run start.
- [ ] **Configure Production SurrealDB Cloud / VPS Connection**: Provide production `VITE_SURREAL_URL`, credentials, and SSL/WSS certificates.

---

### 🎨 Gameplay Polish & World Expansion
- [ ] **Map Expansion & Level 2**: Connect stage doors to secondary map sections or next level.
- [ ] **Audio Assets**: Replace synthesized audio oscillator tones with dedicated sound effects and background music tracks.
- [ ] **Manual Monster Spritesheet Padding**: Fix / add 1-2px internal transparent margin to monster PNGs to eliminate 1px border clipping.



