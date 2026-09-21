import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const command = process.execPath;
const tauriCli = join(process.cwd(), "node_modules", "@tauri-apps", "cli", "tauri.js");

const child = spawn(command, [tauriCli, ...args], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  if (args[0] === "build" && !isInfoOnlyCommand(args)) {
    copyBundlesToDist();
  }
});

function isInfoOnlyCommand(args) {
  return args.some((arg) => arg === "--help" || arg === "-h" || arg === "--version" || arg === "-V");
}

function copyBundlesToDist() {
  const distDir = join(process.cwd(), "dist");
  const bundleDir = join(process.cwd(), "src-tauri", "target", "release", "bundle");
  const allowedExtensions = new Set([".exe", ".msi"]);

  if (!existsSync(bundleDir)) {
    return;
  }

  mkdirSync(distDir, { recursive: true });

  const copied = [];
  for (const filePath of listFiles(bundleDir)) {
    if (!allowedExtensions.has(extname(filePath).toLowerCase())) {
      continue;
    }

    const targetPath = join(distDir, basename(filePath));
    copyFileSync(filePath, targetPath);
    copied.push(targetPath);
  }

  if (copied.length > 0) {
    console.log("");
    console.log("Copied Tauri bundles to dist:");
    for (const filePath of copied) {
      console.log(`  ${filePath}`);
    }
  }
}

function* listFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      yield* listFiles(filePath);
    } else if (stats.isFile()) {
      yield filePath;
    }
  }
}
