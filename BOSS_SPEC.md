# Elecking Mini-Boss Fight & Victory System Specification

## ⚠️ CRITICAL INSTRUCTION BEFORE WRITING ANY CODE:
1. Do NOT write or modify code immediately.
2. Inspect existing codebase files (`MainStageScene.ts`, `EnemyManager.ts`, `EnvironmentManager.ts`, `InventoryManager.ts`, `SecurityManager.ts`, and `SurrealService.ts`).
3. **Mandatory First Response**:
   - Provide a complete guide of all Tiled Map Objects, Object Layers, and Custom Properties the user must configure in Tiled (e.g. Ground Tiles with `dotNumber`, `BossSpawn`, `TemporaryCloud`, `GravityOrb`, `TotemSpawn`).
   - List clarifying technical questions regarding boss hitboxes, animation timing, and minion spawn behaviors.
4. You MUST wait for the user's explicit confirmation and answers before writing any code.

---

## 🎯 Encounter Summary: "Elecking – The Storm Sovereign"
Elecking is the final multi-phase mini-boss of Stage 1. The fight tests sequential pattern memorization, cloud parkour, ground evasive combat with minion adds, and smart use of the Totem of Undying safety net.

---

## 📁 Assets Specification
- **Boss Spritesheet**: `public/assets/sprites/boss/Elecking Power Attack Sprite.png` (Sequential frames lighting up individual 1–5 dot drums/balls in yellow).
- **Thunder & Lightning Effects**: Sequential frames `public/assets/sprites/boss/cloud attack1.png` through `cloud attack5.png` played on targeted tiles.
- **Summoned Minions**: Existing ground mobs (`monsters/Sandal Mob` or similar basic melee mobs from `EnemyManager.ts`).
- **Totem of Undying**: Existing Shield Totem in `InventoryManager.ts` / `CollectiblesManager.ts`.
- **Placeholders (To be replaced later by designer)**:
  - **Gravity Orbs**: Glowing circular sprite / particle placeholder.
  - **Orbs of Rage**: 16x16 projectile placeholder (from `All_Fire_Bullet_Pixel_16x16_04.png`).
  - **Temporary Cloud Platforms**: Semi-transparent rectangular cloud placeholder.
  - **Orb of Victory**: Golden glowing star/orb placeholder.

---

## 🗺️ Tiled Map Objects & Custom Properties Configuration

The AI assistant must guide the user on setting up these objects in Tiled:
1. **Ground Hazard Tiles**: Normal ground tiles in the boss arena with a custom property:
   - `dotNumber: int (1 to 5)`
2. **`BossArenaZone`**: Rectangle object defining the arena boundary where camera locks and boss music/fight triggers.
3. **`BossSpawn`**: Point object for Elecking's starting aerial hover coordinate.
4. **`TemporaryCloud`**: Objects placed along the cloud parkour route.
   - Custom Properties: `standDurationMs: int (e.g. 1800)`, `respawnDelayMs: int (e.g. 2500)`.
5. **`GravityOrb`**: 10 preset point objects placed on cloud routes.
   - Custom Property: `orbIndex: int (1 to 10)`.
6. **`TotemSpawn`**: Secret/challenging parkour spot to collect the optional Totem of Undying.
7. **`VictoryPortalSpawn`**: Point object where the Goal Portal opens upon collecting the Orb of Victory.

---

## ⚙️ Core Mechanics Specification

### 1. Boss Health Pool & Lethal Touch Collision
- **Health Pool**: **50 Blaster Hits** (50 HP). An animated Boss Health Bar is displayed on the top HUD during the fight.
- **Lethal Body Contact**: If the Player touches the boss sprite at ANY point (in the air or floating on the ground), the Player dies instantly.

### 2. Phase 1: Sequential Memory Thunder & Deterministic Gravity Orbs
- **Boss State**: Elecking hovers in the air (invulnerable).
- **Sequential Memory Telegraph**: The boss plays a sequential "drum-beat" animation, lighting up one yellow drum per frame (e.g., Drum #2 $\rightarrow$ Drum #4).
- **Vanish State**: The boss powers up and **disappears completely for 3–4 seconds**.
- **Thunder Strike**: Clouds appear high above ground tiles tagged with the matching `dotNumber` (1–5) and play the `cloud attack1-5.png` lightning animation. Stepping on a struck tile causes instant death.
- **Deterministic Gravity Orbs**: 10 preset Gravity Orbs spawn on temporary cloud platforms. Player collects all 10 to force the boss down to Phase 2.

### 3. Phase 2: Grounded Floating Combat & "Orbs of Rage"
- **Floating Patrol**: Elecking descends to just above ground level and actively patrols left and right across the arena. The Player must use temporary cloud platforms to jump cleanly over the boss when cornered.
- **Combat Loop**:
  - The Player shoots the boss with the Blaster Gun to deplete its 50 HP.
  - While grounded, the boss fires ranged "Orbs of Rage" projectiles at the Player.
- **Witch-Style Minion Summoning (Max 2 Times per Fight)**:
  - At HP thresholds (e.g. at **35 HP** and **15 HP**), the boss pauses and performs a summoning chant, spawning 2–3 small ground minion mobs into the arena to create crowd pressure.
- **Grounded Thunder Transition**: Every 15–20 seconds, the boss pauses projectile firing for ~5 seconds, plays the sequential drum animation, powers up, vanishes, and strikes the numbered floor tiles before reappearing on the ground to resume patrolling.

### 4. Phase 3: Victory Climax, Totem Safety Net & "Orb of Victory"
- When Boss HP hits 0:
  - Boss triggers a grand death explosion and drops the glowing **Orb of Victory**.
  - **Totem of Undying Utility**: If the Player died at any point during the boss fight, the Totem of Undying revives them instantly on the spot with 3s invulnerability without resetting the boss health.
- Touching the **Orb of Victory** activates the **Victory Goal Portal**.

### 5. Stage Clear & SurrealDB Integration
- Stepping through the Victory Portal:
  - Stops speedrun timer.
  - Calls `SurrealService.getInstance().submitRun(...)` to log verified completion time, server-calculated score, and whitelist allocation to SurrealDB.
  - Displays the Victory Summary Screen with global rank `#` and leaderboard stats.
