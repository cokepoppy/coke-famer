import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const cacheRoot = path.join(projectRoot, ".ga-cache");
const cloneDir = path.join(cacheRoot, "generative_agents");

const repoUrl = process.env.GA_REPO_URL ?? "https://github.com/joonspk-research/generative_agents.git";
const ref = process.env.GA_REF ?? "main";

const destRoot = path.join(projectRoot, "public", "ga-assets");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(p) {
  return fs
    .stat(p)
    .then(() => true)
    .catch(() => false);
}

function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

async function copyDir(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.cp(src, dest, { recursive: true, force: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function syncFrom(srcRoot) {
  await ensureDir(destRoot);

  // Characters (sprite sheets + atlas.json)
  await copyDir(path.join(srcRoot, "characters"), path.join(destRoot, "characters"));

  // The Ville visuals (only what the_ville_jan7.json references)
  const visualsRoot = path.join(srcRoot, "the_ville", "visuals");
  const destVisualsRoot = path.join(destRoot, "the_ville", "visuals");

  await copyFile(path.join(visualsRoot, "the_ville_jan7.json"), path.join(destVisualsRoot, "the_ville_jan7.json"));

  await copyDir(path.join(visualsRoot, "map_assets", "blocks"), path.join(destVisualsRoot, "map_assets", "blocks"));
  await copyDir(path.join(visualsRoot, "map_assets", "v1"), path.join(destVisualsRoot, "map_assets", "v1"));
  await copyDir(
    path.join(visualsRoot, "map_assets", "cute_rpg_word_VXAce", "tilesets"),
    path.join(destVisualsRoot, "map_assets", "cute_rpg_word_VXAce", "tilesets")
  );
}

async function main() {
  await ensureDir(cacheRoot);

  if (!(await pathExists(cloneDir))) {
    sh("git", ["clone", "--depth", "1", "--branch", ref, repoUrl, cloneDir]);
  } else {
    sh("git", ["-C", cloneDir, "fetch", "--depth", "1", "origin", ref]);
    sh("git", ["-C", cloneDir, "reset", "--hard", `origin/${ref}`]);
  }

  const srcRoot = path.join(cloneDir, "environment", "frontend_server", "static_dirs", "assets");
  if (!(await pathExists(srcRoot))) {
    throw new Error(`Could not find assets folder after clone: ${srcRoot}`);
  }

  await syncFrom(srcRoot);

  console.log(`已下载并同步资源到：${path.relative(projectRoot, destRoot)}`);
  console.log("提示：这些资源默认不会提交到 git（public/ga-assets 在 .gitignore 中）。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

