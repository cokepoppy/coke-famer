import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const pidFile = path.join(projectRoot, ".preview.pid");
const logFile = path.join(projectRoot, ".preview.log");

async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPid() {
  if (!(await fileExists(pidFile))) return null;
  const pidText = await fs.readFile(pidFile, "utf-8");
  const pid = Number(pidText.trim());
  return Number.isFinite(pid) ? pid : null;
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function start() {
  const existingPid = await readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`preview 已在运行（pid=${existingPid}）。访问：http://localhost:4173/`);
    return;
  }

  const out = await fs.open(logFile, "a");

  const child = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "preview", "--", "--host", "::", "--port", "4173", "--strictPort"],
    {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", out.fd, out.fd],
      env: {
        ...process.env,
        NO_PROXY: "127.0.0.1,localhost,::1",
        no_proxy: "127.0.0.1,localhost,::1",
        http_proxy: "",
        https_proxy: ""
      }
    }
  );

  child.unref();
  await fs.writeFile(pidFile, String(child.pid), "utf-8");
  await out.close();

  console.log(`preview 已启动（pid=${child.pid}）。访问：http://localhost:4173/`);
  console.log(`日志：${path.relative(projectRoot, logFile)}`);
}

async function stop() {
  const pid = await readPid();
  if (!pid) {
    console.log("未找到运行中的 preview（无 pid 文件）。");
    return;
  }
  if (!isRunning(pid)) {
    await fs.rm(pidFile, { force: true });
    console.log(`preview 不在运行（旧 pid=${pid}）。已清理 pid 文件。`);
    return;
  }

  process.kill(pid, "SIGTERM");
  await fs.rm(pidFile, { force: true });
  console.log(`已停止 preview（pid=${pid}）。`);
}

async function status() {
  const pid = await readPid();
  if (!pid) {
    console.log("preview 未运行。");
    return;
  }
  console.log(isRunning(pid) ? `preview 运行中（pid=${pid}）。` : `preview 未运行（旧 pid=${pid}）。`);
}

const cmd = process.argv[2];
if (cmd === "start") {
  await start();
} else if (cmd === "stop") {
  await stop();
} else if (cmd === "status") {
  await status();
} else {
  console.log("用法：node scripts/preview-daemon.mjs <start|stop|status>");
  process.exit(1);
}

