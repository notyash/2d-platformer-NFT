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

### ⏳ Immediate & Near-Term
- [ ] **Configurable Difficulty Modes (Easy / Medium / Hardcore)**:
  - **Easy**: More frequent checkpoints, relaxed hazard intervals, and forgiving mob reaction times.
  - **Medium**: Standard checkpoint distribution and default gameplay balancing.
  - **Hardcore**: Zero checkpoints (full run reset to start on death), faster projectile/mob attack speeds, and stricter platforming windows.
- [ ] **Stage Clear / Victory Trigger**: Add an end-of-stage goal portal / artifact that stops the speedrun timer and shows a victory summary screen.
- [ ] **Mini-Boss Encounter**: Add an end-of-stage mini-boss challenge before the final exit.

---

### ?? Backend, Leaderboard & Web3 Verification
- [ ] **Run Payload & Score Submission API**: Send run metrics (`timeElapsedMs`, `totalDeaths`, `coinsCollected`, `enemiesKilled`, `score`, timestamp) to the Rust/PostgreSQL backend upon stage completion.
- [ ] **Global & Community Leaderboard**: Fetch and display top speedrun times, highest scores, and lowest death runs in-game / victory screen.
- [ ] **Anti-Cheat Verification**: Generate input timeline/hash payloads to validate legitimate clears against API spoofing.
- [ ] **Local Storage & Offline Caching**: Cache user personal bests, high scores, and audio preferences locally as a fallback.

---

### ?? Gameplay Polish & World Expansion
- [ ] **Map Expansion & Level 2**: Connect stage doors to secondary map sections or next level.
- [ ] **Audio Assets**: Replace synthesized audio oscillator tones with dedicated sound effects and background music tracks.
