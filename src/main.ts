import "./style.css";
import { createGame } from "./phaser/createGame";
import { mountHud } from "./ui/hud";

createGame("game-container");
mountHud("hud-controls");
