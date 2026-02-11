import Phaser from "phaser";
import { FarmGame, GAME_CONSTANTS } from "../../simulation/FarmGame";
import type { ActionId, ToolId } from "../../simulation/types";
import { CROPS } from "../../content/crops";
import type { ItemId } from "../../content/items";

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
  private activeChest: { tx: number; ty: number } | null = null;
  private activeContainer:
    | { kind: "chest"; tx: number; ty: number }
    | { kind: "shipping_bin"; tx: number; ty: number }
    | null = null;
  private objectLayer!: Phaser.GameObjects.Layer;
  private objectVisuals = new Map<string, Phaser.GameObjects.Rectangle>();
  private objectBodies!: Phaser.GameObjects.Group;
  private selectedSeed: ItemId = "parsnip_seed";
  private isFreshGame = false;

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

    const loaded = FarmGame.loadFromStorage();
    this.isFreshGame = !loaded;
    this.gameState = loaded ?? FarmGame.newGame();

    this.farmLayer = this.add.layer();
    this.farmLayer.setDepth(ENTITY_DEPTH_BASE - 10);

    this.objectLayer = this.add.layer();
    this.objectLayer.setDepth(ENTITY_DEPTH_BASE + 1);
    this.objectBodies = this.add.group();
    this.physics.add.collider(this.player, this.objectBodies);

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
      if (ev.key === "3") this.setMode(this.selectedSeed as any);
      if (ev.key === "4") this.setMode("hand");
      if (ev.key === "5") this.setMode("chest");
      if (ev.key === "6") this.setMode("axe");
      if (ev.key === "7") this.setMode("pickaxe");
      if (ev.key === "8") this.setMode("fence" as any);
      if (ev.key === "9") this.setMode("path" as any);
      if (ev.key === "0") this.setMode("preserves_jar" as any);
      if (ev.key === "-" || ev.key === "_") this.setMode("sprinkler" as any);
      if (ev.key === "=" || ev.key === "+") this.setMode("quality_sprinkler" as any);
      if (ev.key.toLowerCase() === "q") this.cycleSeed();
      if (ev.key.toLowerCase() === "p") this.setPaused(!this.timePaused);
    });

    const initTx = this.map.worldToTileX(this.player.x) ?? 0;
    const initTy = this.map.worldToTileY(this.player.y) ?? 0;
    this.playerTile = { tx: initTx, ty: initTy };
    this.drawReticle(this.input.activePointer);

    if (this.isFreshGame) this.seedDemoResources();
    this.ensureShippingBin();
    this.gameState.refreshDerivedState();
    this.gameState.saveToStorage();
    this.redrawAllObjects();

    window.__cokeFamer = {
      ready: true,
      player: { x: this.player.x, y: this.player.y, tx: 0, ty: 0 },
      day: this.gameState.day,
      mode: this.mode,
      inventory: {
        parsnip_seed: this.gameState.countItem("parsnip_seed"),
        parsnip: this.gameState.countItem("parsnip")
      },
      gold: this.gameState.gold,
      timePaused: this.timePaused,
      toast: null,
      tilledCount: this.farmVisuals.size,
      lastClick: null,
      lastAction: null,
      api: {
        sleep: () => {
          const res = this.gameState.sleepNextDay();
          if (res.shipped.goldGained > 0) this.toast(`Shipped +${res.shipped.goldGained}g`, "info");
          this.redrawAllFarmTiles();
          this.syncWindowState();
          return res;
        },
        save: () => {
          this.gameState.saveToStorage();
          this.syncWindowState();
        },
        load: () => {
          const loaded = FarmGame.loadFromStorage();
          if (loaded) this.gameState = loaded;
          this.activeChest = null;
          this.activeContainer = null;
          this.ensureShippingBin();
          this.gameState.refreshDerivedState();
          this.redrawAllFarmTiles();
          this.redrawAllObjects();
          this.syncWindowState();
        },
        reset: () => {
          this.gameState.resetToNewGame();
          this.activeChest = null;
          this.activeContainer = null;
          this.redrawAllFarmTiles();
          this.seedDemoResources();
          this.ensureShippingBin();
          this.gameState.refreshDerivedState();
          this.redrawAllObjects();
          this.gameState.saveToStorage();
          this.syncWindowState();
        },
        useAt: (tx: number, ty: number, mode?: string) => {
          if (mode) this.setMode(mode as ActionId);
          return this.applyActionAt(tx, ty);
        },
        setMode: (mode: string) => {
          this.setMode(mode as ActionId);
        },
        getTile: (tx: number, ty: number) => {
          return this.gameState.getTile(tx, ty);
        },
        getObject: (tx: number, ty: number) => {
          return this.gameState.getObject(tx, ty);
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
        },
        shopBuy: (itemId: string, qty: number) => {
          const res = this.gameState.buy(itemId as any, qty);
          if (!res.ok) this.toast(`Buy failed: ${res.reason ?? "unknown"}`, "warn");
          this.syncWindowState();
          this.gameState.saveToStorage();
          return res;
        },
        craft: (itemId: string, qty: number) => {
          const res = this.gameState.craft(itemId as any, qty);
          if (!res.ok) this.toast(`Craft failed: ${res.reason ?? "unknown"}`, "warn");
          else this.toast("Crafted", "info");
          this.syncWindowState();
          this.gameState.saveToStorage();
          return res;
        },
        sellStack: (stack: { itemId: string; qty: number }) => {
          const res = this.gameState.sellStack(stack as any);
          if (res.ok) this.toast(`Sold +${res.goldGained}g`, "info");
          else this.toast(`Sell failed: ${res.reason ?? "unknown"}`, "warn");
          this.syncWindowState();
          this.gameState.saveToStorage();
          return res;
        },
        placeChestAt: (tx: number, ty: number) => {
          const ok = this.gameState.placeChest(tx, ty);
          if (ok) {
            this.toast("Placed chest", "info");
            this.redrawAllObjects();
            this.gameState.saveToStorage();
          } else {
            this.toast("Place chest failed", "warn");
          }
          this.syncWindowState();
          return ok;
        },
        openChestAt: (tx: number, ty: number) => {
          const obj = this.gameState.getObject(tx, ty);
          if (!obj || obj.id !== "chest") return false;
          this.activeChest = { tx, ty };
          this.activeContainer = { kind: "chest", tx, ty };
          this.toast("Chest opened", "info");
          this.syncWindowState();
          return true;
        },
        closeChest: () => {
          this.activeChest = null;
          this.activeContainer = null;
          this.syncWindowState();
        },
        chestPickup: (index: number) => {
          if (!this.activeChest) return null;
          const picked = this.gameState.chestPickup(this.activeChest.tx, this.activeChest.ty, index);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
        },
        chestSplitHalf: (index: number) => {
          if (!this.activeChest) return null;
          const picked = this.gameState.chestSplitHalf(this.activeChest.tx, this.activeChest.ty, index);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
        },
        chestPlace: (index: number, stack: { itemId: string; qty: number }) => {
          if (!this.activeChest) return stack as any;
          const rem = this.gameState.chestPlace(this.activeChest.tx, this.activeChest.ty, index, stack as any);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return rem ? { itemId: rem.itemId, qty: rem.qty } : null;
        },
        chestPlaceOne: (index: number, stack: { itemId: string; qty: number }) => {
          if (!this.activeChest) return { ok: false, remaining: stack as any };
          const res = this.gameState.chestPlaceOne(this.activeChest.tx, this.activeChest.ty, index, stack as any);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return {
            ok: res.ok,
            remaining: res.remaining ? { itemId: res.remaining.itemId, qty: res.remaining.qty } : null
          };
        },
        containerPickup: (index: number) => {
          if (!this.activeContainer) return null;
          if (this.activeContainer.kind === "chest") {
            const picked = this.gameState.chestPickup(this.activeContainer.tx, this.activeContainer.ty, index);
            this.gameState.saveToStorage();
            this.syncWindowState();
            return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
          }
          const picked = this.gameState.shippingPickup(index);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
        },
        containerSplitHalf: (index: number) => {
          if (!this.activeContainer) return null;
          if (this.activeContainer.kind === "chest") {
            const picked = this.gameState.chestSplitHalf(this.activeContainer.tx, this.activeContainer.ty, index);
            this.gameState.saveToStorage();
            this.syncWindowState();
            return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
          }
          const picked = this.gameState.shippingSplitHalf(index);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return picked ? { itemId: picked.itemId, qty: picked.qty } : null;
        },
        containerPlace: (index: number, stack: { itemId: string; qty: number }) => {
          if (!this.activeContainer) return stack as any;
          if (this.activeContainer.kind === "chest") {
            const rem = this.gameState.chestPlace(this.activeContainer.tx, this.activeContainer.ty, index, stack as any);
            this.gameState.saveToStorage();
            this.syncWindowState();
            return rem ? { itemId: rem.itemId, qty: rem.qty } : null;
          }
          const rem = this.gameState.shippingPlace(index, stack as any);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return rem ? { itemId: rem.itemId, qty: rem.qty } : null;
        },
        containerPlaceOne: (index: number, stack: { itemId: string; qty: number }) => {
          if (!this.activeContainer) return { ok: false, remaining: stack as any };
          if (this.activeContainer.kind === "chest") {
            const res = this.gameState.chestPlaceOne(this.activeContainer.tx, this.activeContainer.ty, index, stack as any);
            this.gameState.saveToStorage();
            this.syncWindowState();
            return {
              ok: res.ok,
              remaining: res.remaining ? { itemId: res.remaining.itemId, qty: res.remaining.qty } : null
            };
          }
          const res = this.gameState.shippingPlaceOne(index, stack as any);
          this.gameState.saveToStorage();
          this.syncWindowState();
          return {
            ok: res.ok,
            remaining: res.remaining ? { itemId: res.remaining.itemId, qty: res.remaining.qty } : null
          };
        },
        openShipping: () => {
          this.activeContainer = { kind: "shipping_bin", tx: -1, ty: -1 };
          this.toast("Shipping bin opened (press I to manage items)", "info");
          this.syncWindowState();
        },
        closeContainer: () => {
          this.activeContainer = null;
          this.activeChest = null;
          this.syncWindowState();
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
      parsnip: this.gameState?.countItem("parsnip") ?? 0,
      potato_seed: this.gameState?.countItem("potato_seed" as any) ?? 0,
      blueberry_seed: this.gameState?.countItem("blueberry_seed" as any) ?? 0,
      cranberry_seed: this.gameState?.countItem("cranberry_seed" as any) ?? 0,
      parsnip_jar: this.gameState?.countItem("parsnip_jar" as any) ?? 0,
      potato_jar: this.gameState?.countItem("potato_jar" as any) ?? 0,
      blueberry_jar: this.gameState?.countItem("blueberry_jar" as any) ?? 0,
      cranberry_jar: this.gameState?.countItem("cranberry_jar" as any) ?? 0,
      wood: this.gameState?.countItem("wood" as any) ?? 0,
      stone: this.gameState?.countItem("stone" as any) ?? 0,
      fence: this.gameState?.countItem("fence" as any) ?? 0,
      path: this.gameState?.countItem("path" as any) ?? 0,
      sprinkler: this.gameState?.countItem("sprinkler" as any) ?? 0,
      quality_sprinkler: this.gameState?.countItem("quality_sprinkler" as any) ?? 0,
      preserves_jar: this.gameState?.countItem("preserves_jar" as any) ?? 0,
      chest: this.gameState?.countItem("chest" as any) ?? 0
    };
    window.__cokeFamer.gold = this.gameState?.gold ?? window.__cokeFamer.gold;
    const cal = this.gameState?.getCalendar();
    if (cal) {
      window.__cokeFamer.season = cal.season;
      window.__cokeFamer.dayOfSeason = cal.dayOfSeason;
      window.__cokeFamer.year = cal.year;
      window.__cokeFamer.weather = cal.weather;
    }
    window.__cokeFamer.inventorySlots = this.gameState
      ?.getInventorySlots()
      .map((s) => (s ? { itemId: s.itemId, qty: s.qty } : null));
    window.__cokeFamer.timePaused = this.timePaused;
    window.__cokeFamer.selectedSeed = this.selectedSeed;

    if (this.activeContainer) {
      if (this.activeContainer.kind === "chest") {
        const slots = this.gameState.getChestSlots(this.activeContainer.tx, this.activeContainer.ty) ?? [];
        window.__cokeFamer.container = {
          kind: "chest",
          tx: this.activeContainer.tx,
          ty: this.activeContainer.ty,
          slots: slots.map((s) => (s ? { itemId: s.itemId, qty: s.qty } : null))
        };
      } else {
        const slots = this.gameState.getShippingBinSlots() ?? [];
        window.__cokeFamer.container = {
          kind: "shipping_bin",
          slots: slots.map((s) => (s ? { itemId: s.itemId, qty: s.qty } : null))
        };
      }
    } else {
      window.__cokeFamer.container = null;
    }
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

  private cycleSeed(): void {
    const order: ItemId[] = ["parsnip_seed", "potato_seed", "blueberry_seed", "cranberry_seed"];
    const start = order.indexOf(this.selectedSeed);
    for (let i = 1; i <= order.length; i++) {
      const next = order[(start + i) % order.length]!;
      if ((this.gameState.countItem(next as any) ?? 0) > 0) {
        this.selectedSeed = next;
        this.setMode(this.selectedSeed as any);
        return;
      }
    }
    // If none available, keep current.
    this.toast("No seeds to cycle", "warn");
  }

  private seedDemoResources(): void {
	    // Don't auto-seed if the player already has any non-chest objects (avoid surprising existing saves).
	    const hasNonChest = this.gameState.getAllObjects().some((o) => o.obj.id !== "chest");
	    if (hasNonChest) return;

	    let base = { tx: this.playerTile.tx, ty: this.playerTile.ty };

	    const tryPlaceNear = (kind: "wood" | "stone", preferred: Array<{ tx: number; ty: number }>) => {
	      for (const c of preferred) {
	        if (c.tx < 0 || c.ty < 0 || c.tx >= this.map.width || c.ty >= this.map.height) continue;
	        const blocked = this.collisionsLayer.getTileAt(c.tx, c.ty, true);
	        const isBlocked = Boolean(blocked?.properties?.collide);
	        if (isBlocked) continue;
	        if (c.tx === base.tx && c.ty === base.ty) continue;
	        if (this.gameState.placeResource(c.tx, c.ty, kind)) return true;
	      }
	      return false;
	    };

	    // Place at least one of each near the player for the demo UX (deterministic screenshots + discoverability).
	    let placedWoodNear = tryPlaceNear("wood", [
	      { tx: base.tx + 1, ty: base.ty },
	      { tx: base.tx, ty: base.ty + 1 },
	      { tx: base.tx - 1, ty: base.ty },
	      { tx: base.tx, ty: base.ty - 1 }
	    ]);
	    let placedStoneNear = tryPlaceNear("stone", [
	      { tx: base.tx - 1, ty: base.ty },
	      { tx: base.tx, ty: base.ty - 1 },
	      { tx: base.tx + 1, ty: base.ty },
	      { tx: base.tx, ty: base.ty + 1 }
	    ]);

	    // If we failed to place adjacent nodes (e.g., player spawned near blocked tiles), relocate to a nearby open tile
	    // so the demo always has resources to interact with.
	    if (!placedWoodNear || !placedStoneNear) {
	      const isOpen = (tx: number, ty: number) => {
	        if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
	        const blocked = this.collisionsLayer.getTileAt(tx, ty, true);
	        const isBlocked = Boolean(blocked?.properties?.collide);
	        if (isBlocked) return false;
	        if (this.gameState.getObject(tx, ty)) return false;
	        const t = this.gameState.getTile(tx, ty);
	        if (t.crop || t.tilled || t.watered) return false;
	        return true;
	      };

	      const neighborOffsets = [
	        { dx: 1, dy: 0 },
	        { dx: -1, dy: 0 },
	        { dx: 0, dy: 1 },
	        { dx: 0, dy: -1 }
	      ];

	      let found: { tx: number; ty: number } | null = null;
	      const maxR = 12;
	      for (let r = 1; r <= maxR && !found; r++) {
	        for (let dx = -r; dx <= r && !found; dx++) {
	          const dy = r - Math.abs(dx);
	          const candidates = [
	            { tx: base.tx + dx, ty: base.ty + dy },
	            ...(dy !== 0 ? [{ tx: base.tx + dx, ty: base.ty - dy }] : [])
	          ];
	          for (const c of candidates) {
	            if (!isOpen(c.tx, c.ty)) continue;
	            const openNeighbors = neighborOffsets.filter((o) => isOpen(c.tx + o.dx, c.ty + o.dy)).length;
	            if (openNeighbors >= 2) {
	              found = c;
	              break;
	            }
	          }
	        }
	      }

	      if (found) {
	        base = found;
	        const px = (base.tx + 0.5) * this.map.tileWidth;
	        const py = (base.ty + 0.5) * this.map.tileHeight;
	        this.player.setPosition(px, py);
	        this.playerTile = { tx: base.tx, ty: base.ty };
	        placedWoodNear =
	          placedWoodNear ||
	          tryPlaceNear("wood", [
	            { tx: base.tx + 1, ty: base.ty },
	            { tx: base.tx, ty: base.ty + 1 },
	            { tx: base.tx - 1, ty: base.ty },
	            { tx: base.tx, ty: base.ty - 1 }
	          ]);
	        placedStoneNear =
	          placedStoneNear ||
	          tryPlaceNear("stone", [
	            { tx: base.tx - 1, ty: base.ty },
	            { tx: base.tx, ty: base.ty - 1 },
	            { tx: base.tx + 1, ty: base.ty },
	            { tx: base.tx, ty: base.ty + 1 }
	          ]);
	      }
	    }

	    const candidates: Array<{ tx: number; ty: number }> = [];
	    const maxDist = 10;
	    for (let d = 3; d <= maxDist; d++) {
      for (let dx = -d; dx <= d; dx++) {
        const dy = d - Math.abs(dx);
        candidates.push({ tx: base.tx + dx, ty: base.ty + dy });
        if (dy !== 0) candidates.push({ tx: base.tx + dx, ty: base.ty - dy });
      }
    }

    const placeMany = (kind: "wood" | "stone", count: number) => {
      let placed = 0;
      for (const c of candidates) {
        if (placed >= count) break;
        if (c.tx < 0 || c.ty < 0 || c.tx >= this.map.width || c.ty >= this.map.height) continue;
        const blocked = this.collisionsLayer.getTileAt(c.tx, c.ty, true);
        const isBlocked = Boolean(blocked?.properties?.collide);
        if (isBlocked) continue;
        if (c.tx === base.tx && c.ty === base.ty) continue;
        if (this.gameState.placeResource(c.tx, c.ty, kind)) placed += 1;
      }
    };

    placeMany("wood", 6);
    placeMany("stone", 6);
  }

  private ensureShippingBin(): void {
    const existing = this.gameState.getAllObjects().some((o) => o.obj.id === "shipping_bin");
    if (existing) return;

    const base = { tx: this.playerTile.tx, ty: this.playerTile.ty };
    const candidates = [
      { tx: base.tx + 2, ty: base.ty },
      { tx: base.tx - 2, ty: base.ty },
      { tx: base.tx, ty: base.ty + 2 },
      { tx: base.tx, ty: base.ty - 2 },
      { tx: base.tx + 3, ty: base.ty },
      { tx: base.tx, ty: base.ty + 3 }
    ];

    for (const c of candidates) {
      if (c.tx < 0 || c.ty < 0 || c.tx >= this.map.width || c.ty >= this.map.height) continue;
      const blocked = this.collisionsLayer.getTileAt(c.tx, c.ty, true);
      const isBlocked = Boolean(blocked?.properties?.collide);
      if (isBlocked) continue;
      if (this.gameState.ensureShippingBinAt(c.tx, c.ty)) return;
    }
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

    const cropIdFromSeed = Object.values(CROPS).find((c) => c.seedItemId === this.mode)?.id ?? null;
    const isSeedMode = Boolean(cropIdFromSeed);
    const isPlaceableMode =
      this.mode === "fence" ||
      this.mode === "path" ||
      this.mode === "sprinkler" ||
      this.mode === "quality_sprinkler" ||
      this.mode === "preserves_jar";

    if (
      this.mode === "hoe" ||
      this.mode === "watering_can" ||
      this.mode === "axe" ||
      this.mode === "pickaxe" ||
      isSeedMode
    ) {
      if (this.gameState.energy <= 0) {
        this.toast("No energy", "warn");
        if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok: false, tx, ty };
        return false;
      }
    }
    if (isSeedMode) {
      if ((this.gameState.countItem(this.mode as any) ?? 0) <= 0) {
        this.toast("No seeds", "warn");
        if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok: false, tx, ty };
        return false;
      }
    }
    if (isPlaceableMode) {
      if ((this.gameState.countItem(this.mode as any) ?? 0) <= 0) {
        this.toast("No item to place", "warn");
        if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok: false, tx, ty };
        return false;
      }
    }

    let ok = false;
    if (this.mode === "hoe") ok = this.gameState.hoe(tx, ty);
    else if (this.mode === "watering_can") ok = this.gameState.water(tx, ty);
    else if (isSeedMode) ok = this.gameState.plant(tx, ty, cropIdFromSeed!);
    else if (this.mode === "chest") ok = this.gameState.placeChest(tx, ty);
    else if (this.mode === "fence") ok = this.gameState.placeSimpleObject(tx, ty, "fence");
    else if (this.mode === "path") ok = this.gameState.placeSimpleObject(tx, ty, "path");
    else if (this.mode === "sprinkler") ok = this.gameState.placeSimpleObject(tx, ty, "sprinkler");
    else if (this.mode === "quality_sprinkler") ok = this.gameState.placeSimpleObject(tx, ty, "quality_sprinkler");
    else if (this.mode === "preserves_jar") ok = this.gameState.placePreservesJar(tx, ty);
    else if ((this.mode as ToolId) === "axe") {
      const obj = this.gameState.getObject(tx, ty);
      if (obj?.id === "chest") {
        const res = this.gameState.pickupChestIfEmpty(tx, ty);
        ok = res.ok;
        if (ok) {
          if (this.activeChest && this.activeChest.tx === tx && this.activeChest.ty === ty) this.activeChest = null;
          this.toast("Picked up chest", "info");
        } else if (res.reason === "not_empty") {
          this.toast("Chest not empty", "warn");
        } else if (res.reason === "inv_full") {
          this.toast("Inventory full", "warn");
        } else {
          this.toast("Not a chest", "warn");
        }
      } else if (obj?.id === "fence") {
        ok = this.gameState.pickupSimpleObject(tx, ty, "fence");
        if (ok) this.toast("Picked up fence", "info");
      } else if (obj?.id === "shipping_bin") {
        this.toast("Shipping bin can't be picked up", "warn");
        ok = false;
      } else {
        ok = this.gameState.chop(tx, ty);
      }
    } else if ((this.mode as ToolId) === "pickaxe") {
      const obj = this.gameState.getObject(tx, ty);
      if (obj?.id === "path") {
        ok = this.gameState.pickupSimpleObject(tx, ty, "path");
        if (ok) this.toast("Picked up path", "info");
      } else if (obj?.id === "sprinkler") {
        ok = this.gameState.pickupSimpleObject(tx, ty, "sprinkler");
        if (ok) this.toast("Picked up sprinkler", "info");
      } else if (obj?.id === "quality_sprinkler") {
        ok = this.gameState.pickupSimpleObject(tx, ty, "quality_sprinkler");
        if (ok) this.toast("Picked up quality sprinkler", "info");
      } else if (obj?.id === "preserves_jar") {
        const res = this.gameState.pickupPreservesJarIfIdle(tx, ty);
        ok = res.ok;
        if (ok) this.toast("Picked up jar", "info");
        else if (res.reason === "busy") this.toast("Jar is busy", "warn");
        else if (res.reason === "inv_full") this.toast("Inventory full", "warn");
      } else {
        ok = this.gameState.mine(tx, ty);
      }
    }
    else if ((this.mode as ToolId) === "hand") {
      const obj = this.gameState.getObject(tx, ty);
      if (obj?.id === "chest") {
        this.activeChest = { tx, ty };
        this.activeContainer = { kind: "chest", tx, ty };
        this.toast("Chest opened (press I to manage items)", "info");
        ok = true;
      } else if (obj?.id === "shipping_bin") {
        this.activeChest = null;
        this.activeContainer = { kind: "shipping_bin", tx, ty };
        this.toast("Shipping bin opened (press I to manage items)", "info");
        ok = true;
      } else if (obj?.id === "preserves_jar") {
        const res = this.gameState.interactPreservesJar(tx, ty);
        ok = res.ok;
        if (ok) this.toast("Jar updated", "info");
        else if (res.reason === "processing") this.toast("Jar is processing", "warn");
        else if (res.reason === "no_input") this.toast("No produce to insert", "warn");
        else if (res.reason === "inv_full") this.toast("Inventory full", "warn");
        else this.toast("Jar action failed", "warn");
      } else {
        ok = this.gameState.harvest(tx, ty);
      }
    }

    this.updateFarmTileVisual(tx, ty);
    this.redrawAllObjects();
    this.syncWindowState();

    if (window.__cokeFamer) window.__cokeFamer.lastAction = { kind: this.mode, ok, tx, ty };
    if (!ok) this.toast("Action failed (state/energy/item)", "warn");
    return ok;
  }

  private redrawAllObjects(): void {
    for (const r of this.objectVisuals.values()) r.destroy();
    this.objectVisuals.clear();
    this.objectBodies.clear(true, true);

    for (const o of this.gameState.getAllObjects()) {
      if (o.obj.id === "chest") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 4, y + 8, TILE_SIZE - 8, TILE_SIZE - 8, 0x8b5a2b, 0.9).setOrigin(0);
        rect.setStrokeStyle(1, 0x3b2a18, 0.8);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 10, TILE_SIZE - 10, 0, 0);
      } else if (o.obj.id === "wood") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 6, y + 10, TILE_SIZE - 12, TILE_SIZE - 12, 0x6f4e37, 0.95).setOrigin(0);
        rect.setStrokeStyle(1, 0x3b2a18, 0.75);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 12, TILE_SIZE - 12, 0, 0);
      } else if (o.obj.id === "stone") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 6, y + 10, TILE_SIZE - 12, TILE_SIZE - 12, 0x8b939a, 0.95).setOrigin(0);
        rect.setStrokeStyle(1, 0x2b2f33, 0.75);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 12, TILE_SIZE - 12, 0, 0);
      } else if (o.obj.id === "fence") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 2, y + 18, TILE_SIZE - 4, TILE_SIZE - 20, 0xa87c4f, 0.95).setOrigin(0);
        rect.setStrokeStyle(1, 0x3b2a18, 0.75);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 6, TILE_SIZE - 12, 3, 18);
      } else if (o.obj.id === "path") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 2, y + 22, TILE_SIZE - 4, TILE_SIZE - 24, 0x585f66, 0.85).setOrigin(0);
        rect.setStrokeStyle(1, 0x2b2f33, 0.55);
        rect.setDepth(ENTITY_DEPTH_BASE + y);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
      } else if (o.obj.id === "sprinkler") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 9, y + 10, TILE_SIZE - 18, TILE_SIZE - 18, 0x74c0fc, 0.92).setOrigin(0);
        rect.setStrokeStyle(1, 0x1f2630, 0.7);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 18, TILE_SIZE - 18, 9, 10);
      } else if (o.obj.id === "quality_sprinkler") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 8, y + 9, TILE_SIZE - 16, TILE_SIZE - 16, 0x1864ab, 0.92).setOrigin(0);
        rect.setStrokeStyle(1, 0x0b2545, 0.75);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 16, TILE_SIZE - 16, 8, 9);
      } else if (o.obj.id === "preserves_jar") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const state = o.obj as any;
        const hasOutput = Boolean(state.output);
        const isProcessing = Boolean(state.completeAtAbsMinutes) || Boolean(state.input);
        const color = hasOutput ? 0x4cd964 : isProcessing ? 0xffc107 : 0x5a78c8;
        const rect = this.add.rectangle(x + 6, y + 8, TILE_SIZE - 12, TILE_SIZE - 12, color, 0.92).setOrigin(0);
        rect.setStrokeStyle(1, 0x1f2630, 0.7);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 12, TILE_SIZE - 12, 0, 0);
      } else if (o.obj.id === "shipping_bin") {
        const x = o.tx * this.map.tileWidth;
        const y = o.ty * this.map.tileHeight;
        const rect = this.add.rectangle(x + 2, y + 6, TILE_SIZE - 4, TILE_SIZE - 8, 0x2f80ed, 0.92).setOrigin(0);
        rect.setStrokeStyle(1, 0x163a6b, 0.8);
        rect.setDepth(ENTITY_DEPTH_BASE + y + 2);
        this.objectLayer.add(rect);
        this.objectVisuals.set(`${o.tx},${o.ty}`, rect);
        this.addObjectBody(o.tx, o.ty, TILE_SIZE - 8, TILE_SIZE - 10, 4, 8);
      }
    }
  }

  private addObjectBody(
    tx: number,
    ty: number,
    w: number,
    h: number,
    ox: number,
    oy: number
  ): void {
    const x = tx * this.map.tileWidth;
    const y = ty * this.map.tileHeight;
    const bodyRect = this.add.rectangle(x + ox, y + oy, w, h, 0x000000, 0).setOrigin(0);
    bodyRect.setVisible(false);
    this.physics.add.existing(bodyRect, true);
    this.objectBodies.add(bodyRect);
  }

  private tickClock(deltaMs: number): void {
    if (this.timePaused) return;
    this.timeAccumulatorMs += deltaMs;
    let advanced = false;
    while (this.timeAccumulatorMs >= this.msPerMinute) {
      this.timeAccumulatorMs -= this.msPerMinute;
      this.gameState.advanceMinutes(1);
      advanced = true;
      if (this.gameState.minutes >= GAME_CONSTANTS.DAY_END_MINUTES) {
        this.toast("2:00 AM — You passed out. New day.", "warn");
        const res = this.gameState.sleepNextDay();
        if (res.shipped.goldGained > 0) this.toast(`Shipped +${res.shipped.goldGained}g`, "info");
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
