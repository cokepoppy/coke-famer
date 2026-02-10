import Phaser from "phaser";
import { FarmGame, GAME_CONSTANTS } from "../../simulation/FarmGame";
import type { ActionId, ToolId } from "../../simulation/types";
import { CROPS } from "../../content/crops";

const ASSETS_BASE = "ga-assets";
const TILE_SIZE = 32;
const ENTITY_DEPTH_BASE = 1000;

type Direction = "u" | "d" | "l" | "r";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super("WorldScene");
  }

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private map!: Phaser.Tilemaps.Tilemap;
  private collisionsLayer!: Phaser.Tilemaps.TilemapLayer;

  private player!: Phaser.Physics.Arcade.Sprite;
  private lastDir: Direction = "d";

  private reticle!: Phaser.GameObjects.Graphics;
  private farmLayer!: Phaser.GameObjects.Layer;
  private farmVisuals = new Map<
    string,
    {
      tilled?: Phaser.GameObjects.Rectangle;
      watered?: Phaser.GameObjects.Rectangle;
      crop?: Phaser.GameObjects.Rectangle;
    }
  >();

  private gameState!: FarmGame;
  private mode: ActionId = "hoe";
  private playerTile = { tx: 0, ty: 0 };
  private timePaused = false;
  private timeAccumulatorMs = 0;
  private readonly msPerMinute = 700; // ~Stardew: 10 minutes per 7 seconds

  preload(): void {
    this.load.tilemapTiledJSON(
      "the_ville",
      `${ASSETS_BASE}/the_ville/visuals/the_ville_jan7.json`
    );

    // Tilesets referenced by the map JSON.
    this.load.image(
      "blocks_1",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/blocks/blocks_1.png`
    );
    this.load.image(
      "blocks_2",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/blocks/blocks_2.png`
    );
    this.load.image(
      "blocks_3",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/blocks/blocks_3.png`
    );
    this.load.image(
      "walls",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/v1/Room_Builder_32x32.png`
    );
    this.load.image(
      "interiors_pt1",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/v1/interiors_pt1.png`
    );
    this.load.image(
      "interiors_pt2",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/v1/interiors_pt2.png`
    );
    this.load.image(
      "interiors_pt3",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/v1/interiors_pt3.png`
    );
    this.load.image(
      "interiors_pt4",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/v1/interiors_pt4.png`
    );
    this.load.image(
      "interiors_pt5",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/v1/interiors_pt5.png`
    );

    this.load.image(
      "CuteRPG_Field_B",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_B.png`
    );
    this.load.image(
      "CuteRPG_Field_C",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Field_C.png`
    );
    this.load.image(
      "CuteRPG_Harbor_C",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Harbor_C.png`
    );
    this.load.image(
      "CuteRPG_Village_B",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Village_B.png`
    );
    this.load.image(
      "CuteRPG_Forest_B",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_B.png`
    );
    this.load.image(
      "CuteRPG_Desert_C",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_C.png`
    );
    this.load.image(
      "CuteRPG_Mountains_B",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Mountains_B.png`
    );
    this.load.image(
      "CuteRPG_Desert_B",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Desert_B.png`
    );
    this.load.image(
      "CuteRPG_Forest_C",
      `${ASSETS_BASE}/the_ville/visuals/map_assets/cute_rpg_word_VXAce/tilesets/CuteRPG_Forest_C.png`
    );

    // Player atlas: 96x128 spritesheet with TexturePacker JSON Array (per character).
    this.load.atlas(
      "player",
      `${ASSETS_BASE}/characters/Maria_Lopez.png`,
      `${ASSETS_BASE}/characters/atlas.json`
    );
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;

    this.map = this.make.tilemap({ key: "the_ville" });

    const must = (tileset: Phaser.Tilemaps.Tileset | null, name: string): Phaser.Tilemaps.Tileset => {
      if (!tileset) throw new Error(`Tileset not found in map: ${name}`);
      return tileset;
    };

    const collisions = must(this.map.addTilesetImage("blocks", "blocks_1"), "blocks");
    const blocks2 = must(this.map.addTilesetImage("blocks_2", "blocks_2"), "blocks_2");
    const blocks3 = must(this.map.addTilesetImage("blocks_3", "blocks_3"), "blocks_3");
    const walls = must(this.map.addTilesetImage("Room_Builder_32x32", "walls"), "Room_Builder_32x32");
    const interiorsPt1 = must(this.map.addTilesetImage("interiors_pt1", "interiors_pt1"), "interiors_pt1");
    const interiorsPt2 = must(this.map.addTilesetImage("interiors_pt2", "interiors_pt2"), "interiors_pt2");
    const interiorsPt3 = must(this.map.addTilesetImage("interiors_pt3", "interiors_pt3"), "interiors_pt3");
    const interiorsPt4 = must(this.map.addTilesetImage("interiors_pt4", "interiors_pt4"), "interiors_pt4");
    const interiorsPt5 = must(this.map.addTilesetImage("interiors_pt5", "interiors_pt5"), "interiors_pt5");

    const CuteRPG_Field_B = must(
      this.map.addTilesetImage("CuteRPG_Field_B", "CuteRPG_Field_B"),
      "CuteRPG_Field_B"
    );
    const CuteRPG_Field_C = must(
      this.map.addTilesetImage("CuteRPG_Field_C", "CuteRPG_Field_C"),
      "CuteRPG_Field_C"
    );
    const CuteRPG_Harbor_C = must(
      this.map.addTilesetImage("CuteRPG_Harbor_C", "CuteRPG_Harbor_C"),
      "CuteRPG_Harbor_C"
    );
    const CuteRPG_Village_B = must(
      this.map.addTilesetImage("CuteRPG_Village_B", "CuteRPG_Village_B"),
      "CuteRPG_Village_B"
    );
    const CuteRPG_Forest_B = must(
      this.map.addTilesetImage("CuteRPG_Forest_B", "CuteRPG_Forest_B"),
      "CuteRPG_Forest_B"
    );
    const CuteRPG_Desert_C = must(
      this.map.addTilesetImage("CuteRPG_Desert_C", "CuteRPG_Desert_C"),
      "CuteRPG_Desert_C"
    );
    const CuteRPG_Mountains_B = must(
      this.map.addTilesetImage("CuteRPG_Mountains_B", "CuteRPG_Mountains_B"),
      "CuteRPG_Mountains_B"
    );
    const CuteRPG_Desert_B = must(
      this.map.addTilesetImage("CuteRPG_Desert_B", "CuteRPG_Desert_B"),
      "CuteRPG_Desert_B"
    );
    const CuteRPG_Forest_C = must(
      this.map.addTilesetImage("CuteRPG_Forest_C", "CuteRPG_Forest_C"),
      "CuteRPG_Forest_C"
    );

    const tilesetGroup1: Phaser.Tilemaps.Tileset[] = [
      CuteRPG_Field_B,
      CuteRPG_Field_C,
      CuteRPG_Harbor_C,
      CuteRPG_Village_B,
      CuteRPG_Forest_B,
      CuteRPG_Desert_C,
      CuteRPG_Mountains_B,
      CuteRPG_Desert_B,
      CuteRPG_Forest_C,
      interiorsPt1,
      interiorsPt2,
      interiorsPt3,
      interiorsPt4,
      interiorsPt5,
      walls,
      collisions,
      blocks2,
      blocks3
    ];

    this.map.createLayer("Bottom Ground", tilesetGroup1, 0, 0);
    this.map.createLayer("Exterior Ground", tilesetGroup1, 0, 0);
    this.map.createLayer("Exterior Decoration L1", tilesetGroup1, 0, 0);
    this.map.createLayer("Exterior Decoration L2", tilesetGroup1, 0, 0);
    this.map.createLayer("Interior Ground", tilesetGroup1, 0, 0);
    this.map.createLayer("Wall", [CuteRPG_Field_C, walls], 0, 0);
    this.map.createLayer("Interior Furniture L1", tilesetGroup1, 0, 0);
    this.map.createLayer("Interior Furniture L2 ", tilesetGroup1, 0, 0);

    const fg1 = this.map.createLayer("Foreground L1", tilesetGroup1, 0, 0);
    const fg2 = this.map.createLayer("Foreground L2", tilesetGroup1, 0, 0);
    const overheadDepth = ENTITY_DEPTH_BASE + this.map.heightInPixels + 5000;
    fg1?.setDepth(overheadDepth);
    fg2?.setDepth(overheadDepth);

    this.collisionsLayer = this.map.createLayer("Collisions", collisions, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.collisionsLayer.setCollisionByProperty({ collide: true });
    this.collisionsLayer.setVisible(false);

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    this.player = this.physics.add.sprite(1856, 288, "player", "down");
    this.player.setCollideWorldBounds(true);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setSize(16, 16);
    playerBody.setOffset(8, 14);
    this.physics.add.collider(this.player, this.collisionsLayer);

    const camera = this.cameras.main;
    camera.startFollow(this.player, true, 0.15, 0.15);
    camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    this.createPlayerAnims();

    this.reticle = this.add.graphics();
    this.reticle.setDepth(overheadDepth + 100);

    this.gameState = FarmGame.loadFromStorage() ?? FarmGame.newGame();
    this.gameState.saveToStorage();

    this.farmLayer = this.add.layer();
    this.farmLayer.setDepth(ENTITY_DEPTH_BASE - 10);

    this.redrawAllFarmTiles();

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.drawReticle(pointer);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.useOnTile(pointer);
    });

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, (ev: KeyboardEvent) => {
      if (ev.key === "1") this.setMode("hoe");
      if (ev.key === "2") this.setMode("watering_can");
      if (ev.key === "3") this.setMode("parsnip_seed");
      if (ev.key === "4") this.setMode("hand");
      if (ev.key.toLowerCase() === "p") this.setPaused(!this.timePaused);
    });

    const initTx = this.map.worldToTileX(this.player.x) ?? 0;
    const initTy = this.map.worldToTileY(this.player.y) ?? 0;
    this.playerTile = { tx: initTx, ty: initTy };
    this.drawReticle(this.input.activePointer);

    window.__cokeFamer = {
      ready: true,
      player: { x: this.player.x, y: this.player.y, tx: 0, ty: 0 },
      day: this.gameState.day,
      mode: this.mode,
      inventory: {
        parsnip_seed: this.gameState.countItem("parsnip_seed"),
        parsnip: this.gameState.countItem("parsnip")
      },
      timePaused: this.timePaused,
      toast: null,
      tilledCount: this.farmVisuals.size,
      lastClick: null,
      lastAction: null,
      api: {
        sleep: () => {
          this.gameState.sleepNextDay();
          this.redrawAllFarmTiles();
          this.syncWindowState();
        },
        save: () => {
          this.gameState.saveToStorage();
          this.syncWindowState();
        },
        load: () => {
          const loaded = FarmGame.loadFromStorage();
          if (loaded) this.gameState = loaded;
          this.redrawAllFarmTiles();
          this.syncWindowState();
        },
        reset: () => {
          this.gameState.resetToNewGame();
          this.redrawAllFarmTiles();
          this.syncWindowState();
        },
        useAt: (tx: number, ty: number, mode?: string) => {
          if (mode) this.setMode(mode as ActionId);
          return this.applyActionAt(tx, ty);
        },
        setPaused: (paused: boolean) => {
          this.setPaused(paused);
        },
        invPickup: (index: number) => {
          const picked = this.gameState.inventoryPickup(index);
          this.syncWindowState();
          return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
        },
        invSplitHalf: (index: number) => {
          const picked = this.gameState.inventorySplitHalf(index);
          this.syncWindowState();
          return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
        },
        invPlace: (index: number, stack: { itemId: string; qty: number }) => {
          const rem = this.gameState.inventoryPlace(index, stack as any);
          this.syncWindowState();
          return rem ? { itemId: rem.itemId, qty: rem.qty } : null;
        },
        invPlaceOne: (index: number, stack: { itemId: string; qty: number }) => {
          const res = this.gameState.inventoryPlaceOne(index, stack as any);
          this.syncWindowState();
          return {
            ok: res.ok,
            remaining: res.remaining ? { itemId: res.remaining.itemId, qty: res.remaining.qty } : null
          };
        }
      }
    };
    this.syncWindowState();
  }

  update(_time: number, delta: number): void {
    this.tickClock(delta);

    const speed = 180;
    const vx =
      (this.cursors.left.isDown || this.wasd.A.isDown ? -1 : 0) +
      (this.cursors.right.isDown || this.wasd.D.isDown ? 1 : 0);
    const vy =
      (this.cursors.up.isDown || this.wasd.W.isDown ? -1 : 0) +
      (this.cursors.down.isDown || this.wasd.S.isDown ? 1 : 0);

    const vec = new Phaser.Math.Vector2(vx, vy);
    if (vec.lengthSq() > 1) vec.normalize();

    this.player.setVelocity(vec.x * speed, vec.y * speed);

    const moving = vec.lengthSq() > 0;
    if (moving) {
      if (Math.abs(vec.x) > Math.abs(vec.y)) this.lastDir = vec.x > 0 ? "r" : "l";
      else this.lastDir = vec.y > 0 ? "d" : "u";
      this.playWalkAnim(this.lastDir);
    } else {
      this.player.anims.stop();
      this.player.setTexture("player", this.idleFrame(this.lastDir));
    }

    this.player.setDepth(ENTITY_DEPTH_BASE + this.player.y);

    const tx = this.map.worldToTileX(this.player.x) ?? 0;
    const ty = this.map.worldToTileY(this.player.y) ?? 0;
    this.playerTile = { tx, ty };
    if (window.__cokeFamer) window.__cokeFamer.player = { x: this.player.x, y: this.player.y, tx, ty };
  }

  private createPlayerAnims(): void {
    const anims = this.anims;
    const mk = (key: string, prefix: string) => {
      if (anims.exists(key)) return;
      anims.create({
        key,
        frames: anims.generateFrameNames("player", { prefix, start: 0, end: 3, zeroPad: 3 }),
        frameRate: 8,
        repeat: -1
      });
    };
    mk("walk-d", "down-walk.");
    mk("walk-u", "up-walk.");
    mk("walk-l", "left-walk.");
    mk("walk-r", "right-walk.");
  }

  private playWalkAnim(dir: Direction): void {
    const key = `walk-${dir}`;
    if (this.player.anims.currentAnim?.key !== key) this.player.anims.play(key, true);
  }

  private idleFrame(dir: Direction): string {
    if (dir === "u") return "up";
    if (dir === "d") return "down";
    if (dir === "l") return "left";
    return "right";
  }

  private tileFromPointer(pointer: Phaser.Input.Pointer): { tx: number; ty: number } | null {
    const cam = this.cameras.main;
    const worldPoint = pointer.positionToCamera(cam) as Phaser.Math.Vector2;
    const tx = this.map.worldToTileX(worldPoint.x);
    const ty = this.map.worldToTileY(worldPoint.y);
    if (tx == null || ty == null) return null;
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return null;
    return { tx, ty };
  }

  private drawReticle(pointer: Phaser.Input.Pointer): void {
    const tile = this.tileFromPointer(pointer);
    this.reticle.clear();
    if (!tile) return;

    const x = tile.tx * this.map.tileWidth;
    const y = tile.ty * this.map.tileHeight;

    const blocked = this.collisionsLayer.getTileAt(tile.tx, tile.ty, true);
    const isBlocked = Boolean(blocked?.properties?.collide);
    const dist = Math.abs(tile.tx - this.playerTile.tx) + Math.abs(tile.ty - this.playerTile.ty);
    const inRange = dist <= 1;
    const color = isBlocked ? 0xff4d4f : inRange ? 0x3ddc97 : 0xffc107;

    this.reticle.lineStyle(2, color, 0.9);
    this.reticle.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  private setMode(mode: ActionId): void {
    this.mode = mode;
    this.toast(`Mode: ${mode}`, "info");
    this.syncWindowState();
  }

  private setPaused(paused: boolean): void {
    this.timePaused = paused;
    if (window.__cokeFamer) window.__cokeFamer.timePaused = paused;
    this.toast(paused ? "Time paused" : "Time resumed", "info");
  }

  private toast(text: string, kind: "info" | "warn" | "error"): void {
    if (!window.__cokeFamer) return;
    window.__cokeFamer.toast = { text, kind, ts: Date.now() };
  }

  private syncWindowState(): void {
    if (!window.__cokeFamer) return;
    window.__cokeFamer.day = this.gameState?.day ?? window.__cokeFamer.day;
    window.__cokeFamer.minutes = this.gameState?.minutes ?? window.__cokeFamer.minutes;
    window.__cokeFamer.timeText = this.formatTime(this.gameState?.minutes ?? GAME_CONSTANTS.DAY_START_MINUTES);
    window.__cokeFamer.energy = this.gameState?.energy ?? window.__cokeFamer.energy;
    window.__cokeFamer.energyMax = GAME_CONSTANTS.ENERGY_MAX;
    window.__cokeFamer.mode = this.mode;
    window.__cokeFamer.inventory = {
      parsnip_seed: this.gameState?.countItem("parsnip_seed") ?? 0,
      parsnip: this.gameState?.countItem("parsnip") ?? 0
    };
    window.__cokeFamer.inventorySlots = this.gameState
      ?.getInventorySlots()
      .map((s) => (s ? { itemId: s.itemId, qty: s.qty } : null));
    window.__cokeFamer.timePaused = this.timePaused;
  }

  private formatTime(minutes: number): string {
    const m = minutes % (24 * 60);
    const h24 = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    return `${h12}:${mm} ${ampm}`;
  }

  private useOnTile(pointer: Phaser.Input.Pointer): void {
    const tile = this.tileFromPointer(pointer);
    if (!tile) return;

    const ok = this.applyActionAt(tile.tx, tile.ty);
    if (window.__cokeFamer) window.__cokeFamer.lastClick = { tx: tile.tx, ty: tile.ty, blocked: false, toggled: ok };
  }

  private applyActionAt(tx: number, ty: number): boolean {
    const blocked = this.collisionsLayer.getTileAt(tx, ty, true);
    const isBlocked = Boolean(blocked?.properties?.collide);
    const dist = Math.abs(tx - this.playerTile.tx) + Math.abs(ty - this.playerTile.ty);
    const inRange = dist <= 1;
    if (isBlocked || !inRange) {
      if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok: false, tx, ty };
      if (isBlocked) this.toast("Blocked tile", "warn");
      else this.toast("Too far (need adjacent tile)", "warn");
      return false;
    }

    if (this.mode === "hoe" || this.mode === "watering_can" || this.mode === "parsnip_seed") {
      if (this.gameState.energy <= 0) {
        this.toast("No energy", "warn");
        if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok: false, tx, ty };
        return false;
      }
    }
    if (this.mode === "parsnip_seed" && this.gameState.countItem("parsnip_seed") <= 0) {
      this.toast("No seeds", "warn");
      if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok: false, tx, ty };
      return false;
    }

    let ok = false;
    if (this.mode === "hoe") ok = this.gameState.hoe(tx, ty);
    else if (this.mode === "watering_can") ok = this.gameState.water(tx, ty);
    else if (this.mode === "parsnip_seed") ok = this.gameState.plant(tx, ty, "parsnip");
    else if ((this.mode as ToolId) === "hand") ok = this.gameState.harvest(tx, ty);

    this.updateFarmTileVisual(tx, ty);
    this.syncWindowState();

    if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok, tx, ty };
    if (!ok) this.toast("Action failed (state/energy/item)", "warn");
    return ok;
  }

  private tickClock(deltaMs: number): void {
    if (this.timePaused) return;
    this.timeAccumulatorMs += deltaMs;
    let advanced = false;
    while (this.timeAccumulatorMs >= this.msPerMinute) {
      this.timeAccumulatorMs -= this.msPerMinute;
      this.gameState.minutes += 1;
      advanced = true;
      if (this.gameState.minutes >= GAME_CONSTANTS.DAY_END_MINUTES) {
        this.toast("2:00 AM — You passed out. New day.", "warn");
        this.gameState.sleepNextDay();
        this.redrawAllFarmTiles();
        break;
      }
    }
    if (advanced) this.syncWindowState();
  }

  private updateFarmTileVisual(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    const state = this.gameState.getTile(tx, ty);
    let visuals = this.farmVisuals.get(key);
    if (!visuals) {
      visuals = {};
      this.farmVisuals.set(key, visuals);
    }

    const x = tx * this.map.tileWidth;
    const y = ty * this.map.tileHeight;

    // Tilled
    if (state.tilled) {
      if (!visuals.tilled) {
        const rect = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x6b4e2e, 0.55).setOrigin(0);
        rect.setStrokeStyle(1, 0x3b2a18, 0.6);
        rect.setDepth(ENTITY_DEPTH_BASE - 10 + y);
        this.farmLayer.add(rect);
        visuals.tilled = rect;
      }
    } else if (visuals.tilled) {
      visuals.tilled.destroy();
      delete visuals.tilled;
    }

    // Watered
    if (state.watered) {
      if (!visuals.watered) {
        const rect = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x2d7dd2, 0.25).setOrigin(0);
        rect.setDepth(ENTITY_DEPTH_BASE - 9 + y);
        this.farmLayer.add(rect);
        visuals.watered = rect;
      }
    } else if (visuals.watered) {
      visuals.watered.destroy();
      delete visuals.watered;
    }

    // Crop (simple placeholder)
    if (state.crop) {
      const def = CROPS[state.crop.cropId];
      const harvestStage = def.growthDaysPerStage.length;
      const mature = state.crop.stage >= harvestStage;
      const color = mature ? 0x4cd964 : 0xd0b04f;
      if (!visuals.crop) {
        const rect = this.add
          .rectangle(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16, color, 0.9)
          .setOrigin(0);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 1);
        this.farmLayer.add(rect);
        visuals.crop = rect;
      } else {
        visuals.crop.setFillStyle(color, 0.9);
      }
    } else if (visuals.crop) {
      visuals.crop.destroy();
      delete visuals.crop;
    }

    // Cleanup empty visuals
    if (!visuals.tilled && !visuals.watered && !visuals.crop) {
      this.farmVisuals.delete(key);
    }
  }

  private redrawAllFarmTiles(): void {
    for (const v of this.farmVisuals.values()) {
      v.tilled?.destroy();
      v.watered?.destroy();
      v.crop?.destroy();
    }
    this.farmVisuals.clear();

    for (const t of this.gameState.getAllTiles()) {
      this.updateFarmTileVisual(t.tx, t.ty);
    }

    if (window.__cokeFamer) window.__cokeFamer.tilledCount = this.farmVisuals.size;
  }
}
