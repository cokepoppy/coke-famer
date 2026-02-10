import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_GA_ASSETS_SRC =
  "/Users/shangguanchenhuan/Documents/home2025/generative_agents/environment/frontend_server/static_dirs/assets";

const projectRoot = process.cwd();
const srcRoot = process.env.GA_ASSETS_SRC ?? DEFAULT_GA_ASSETS_SRC;
const destRoot = path.join(projectRoot, "public", "ga-assets");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.cp(src, dest, { recursive: true, force: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function main() {
  const checks = await fs
    .stat(srcRoot)
    .then(() => true)
    .catch(() => false);
  if (!checks) {
    console.error(
      `找不到 generative_agents assets 路径：${srcRoot}\n` +
        `可通过环境变量指定：GA_ASSETS_SRC=/path/to/.../static_dirs/assets`
    );
    process.exit(1);
  }

  await ensureDir(destRoot);

  // Characters (sprite sheets + atlas.json)
  await copyDir(path.join(srcRoot, "characters"), path.join(destRoot, "characters"));

  // The Ville visuals (only what the_ville_jan7.json references)
  const visualsRoot = path.join(srcRoot, "the_ville", "visuals");
  const destVisualsRoot = path.join(destRoot, "the_ville", "visuals");

  await copyFile(
    path.join(visualsRoot, "the_ville_jan7.json"),
    path.join(destVisualsRoot, "the_ville_jan7.json")
  );

  await copyDir(
    path.join(visualsRoot, "map_assets", "blocks"),
    path.join(destVisualsRoot, "map_assets", "blocks")
  );
  await copyDir(
    path.join(visualsRoot, "map_assets", "v1"),
    path.join(destVisualsRoot, "map_assets", "v1")
  );
  await copyDir(
    path.join(visualsRoot, "map_assets", "cute_rpg_word_VXAce", "tilesets"),
    path.join(destVisualsRoot, "map_assets", "cute_rpg_word_VXAce", "tilesets")
  );

  console.log(`已同步资源到：${path.relative(projectRoot, destRoot)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

