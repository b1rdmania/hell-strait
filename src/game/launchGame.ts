import Phaser from "phaser";
import { PatrolScene } from "./PatrolScene";

export function createPatrolGame(
  parentId: string,
  onExit: () => void,
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: parentId,
    width: 320,
    height: 256,
    backgroundColor: "#050a12",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [PatrolScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  game.registry.set("onExit", onExit);
  return game;
}
