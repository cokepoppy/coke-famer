import Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

export function createGame(parentId: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: "#0b0d10",
    pixelArt: true,
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    scene: [WorldScene]
  };

  return new Phaser.Game(config);
}

