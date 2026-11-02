#!/usr/bin/env bun
/**
 * local.ts
 *
 * Global HL7 FHIR Learning Lab — Zero-Docker Local Dev Runner (Host Bun).
 * Menjalankan Frontend Web App Vite SPA (port 5173) secara langsung di host
 * tanpa ketergantungan Docker container.
 *
 * Menolak port yang sudah dipakai tanpa memberi sinyal pada proses asing.
 * Shutdown hanya menghentikan child handle yang dibuat oleh runner ini.
 *
 * Usage:
 *   bun scripts/local.ts [--port 5173] [--force-kill] [--dry-run]
 */

import { execSync, spawn } from "child_process";
import { resolve } from "path";
import { EventEmitter } from "events";

export const ROOT = resolve(import.meta.dir, "..");
export const DEFAULT_PORT = 5173;
export const KNOWN_DEV_PROCESSES = ["bun", "bun.exe", "node", "node.exe", "vite", "vite.cmd", "npm", "npx"];

export interface ListeningProcess {
  port: number;
  pid: number;
  name: string;
}

export function getProcessName(pid: number): string {
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const match = out.match(/"([^"]+)"/);
      if (match && match[1]) return match[1];
    } else {
      const out = execSync(`ps -p ${pid} -o comm=`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (out.trim()) return out.trim();
    }
  } catch {}
  return "unknown";
}

export function parseNetstatOutput(
  output: string,
  ports: number[],
  selfPid: number = process.pid,
  ppid: number = process.ppid
): ListeningProcess[] {
  const results: ListeningProcess[] = [];
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5 && parts[0].toUpperCase() === "TCP" && parts[3].toUpperCase() === "LISTENING") {
      const localAddr = parts[1];
      const pid = parseInt(parts[4], 10);
      if (isNaN(pid) || pid <= 4 || pid === selfPid || pid === ppid) continue;

      for (const port of ports) {
        if (localAddr.endsWith(`:${port}`) || localAddr.endsWith(`.${port}`)) {
          results.push({ port, pid, name: "" });
        }
      }
    }
  }
  return results;
}

export function findListeningProcesses(ports: number[]): ListeningProcess[] {
  const results: ListeningProcess[] = [];
  const selfPid = process.pid;
  const parentPid = process.ppid;

  if (process.platform === "win32") {
    try {
      const output = execSync("netstat -ano", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const parsed = parseNetstatOutput(output, ports, selfPid, parentPid);
      for (const item of parsed) {
        results.push({
          ...item,
          name: getProcessName(item.pid),
        });
      }
    } catch {}
  } else {
    for (const port of ports) {
      try {
        const output = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -t`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const pids = output
          .trim()
          .split(/\s+/)
          .map((p) => parseInt(p, 10))
          .filter((p) => !isNaN(p));
        for (const pid of pids) {
          if (pid <= 1 || pid === selfPid || pid === parentPid) continue;
          results.push({ port, pid, name: getProcessName(pid) });
        }
      } catch {}
    }
  }

  const unique = new Map<string, ListeningProcess>();
  for (const item of results) {
    unique.set(`${item.port}-${item.pid}`, item);
  }
  return Array.from(unique.values());
}

export interface OwnedChildProcess {
  pid?: number;
  stdout?: { on(event: "data", listener: (chunk: Buffer | string) => void): void } | null;
  stderr?: { on(event: "data", listener: (chunk: Buffer | string) => void): void } | null;
  on(event: "error", listener: (err: Error) => void): this | void;
  on(event: "exit", listener: (code: number | null, signal: string | null) => void): this | void;
  on(event: "close", listener: (code: number | null, signal: string | null) => void): this | void;
  kill(signal?: string | number): boolean | void;
  exitCode?: number | null;
  killed?: boolean;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  shell?: boolean;
  stdio?: ("ignore" | "pipe" | "inherit")[];
}

export interface ProcessAdapter {
  isBunAvailable(): boolean;
  findListeningProcesses(ports: number[]): ListeningProcess[];
  spawnChild(command: string, args: string[], options: SpawnOptions): OwnedChildProcess;
  killChild(child: OwnedChildProcess): void;
  onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): () => void;
  exit(code: number): void;
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

export class NativeProcessAdapter implements ProcessAdapter {
  isBunAvailable(): boolean {
    if (typeof Bun !== "undefined") return true;
    try {
      const probe = process.platform === "win32" ? "where bun" : "command -v bun";
      execSync(probe, { stdio: ["ignore", "pipe", "ignore"] });
      return true;
    } catch {
      return false;
    }
  }

  findListeningProcesses(ports: number[]): ListeningProcess[] {
    return findListeningProcesses(ports);
  }

  spawnChild(command: string, args: string[], options: SpawnOptions): OwnedChildProcess {
    return spawn(command, args, {
      ...options,
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      shell: options.shell ?? (process.platform === "win32"),
    }) as OwnedChildProcess;
  }

  killChild(child: OwnedChildProcess): void {
    if (!child || !child.pid || child.killed || child.exitCode !== null) return;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch {}
  }

  onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): () => void {
    process.on(signal, handler);
    return () => {
      process.off(signal, handler);
    };
  }

  exit(code: number): void {
    process.exit(code);
  }

  log(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }

  warn(message: string): void {
    console.warn(message);
  }
}

export class FakeChildProcess extends EventEmitter implements OwnedChildProcess {
  public pid: number;
  public stdout: EventEmitter;
  public stderr: EventEmitter;
  public exitCode: number | null = null;
  public killed: boolean = false;
  public signalsReceived: (string | number | undefined)[] = [];

  constructor(pid: number) {
    super();
    this.pid = pid;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }

  kill(signal?: string | number): boolean {
    this.killed = true;
    this.signalsReceived.push(signal);
    return true;
  }

  simulateExit(code: number | null, signal: string | null = null): void {
    this.exitCode = code;
    this.emit("exit", code, signal);
    this.emit("close", code, signal);
  }

  simulateError(err: Error): void {
    this.emit("error", err);
  }

  simulateStdout(data: string): void {
    this.stdout.emit("data", Buffer.from(data));
  }

  simulateStderr(data: string): void {
    this.stderr.emit("data", Buffer.from(data));
  }
}

export interface FakeProcessAdapterOptions {
  bunAvailable?: boolean;
  listeningProcesses?: ListeningProcess[];
  nextPid?: number;
}

export class FakeProcessAdapter implements ProcessAdapter {
  public bunAvailable: boolean;
  public listeningProcesses: ListeningProcess[];
  public nextPid: number;
  public spawnedChildren: { command: string; args: string[]; options: SpawnOptions; child: FakeChildProcess }[] = [];
  public signalsSent: { pid?: number; signal?: string | number }[] = [];
  public exitCalls: number[] = [];
  public logs: string[] = [];
  public errors: string[] = [];
  public warnings: string[] = [];
  private signalHandlers: Record<"SIGINT" | "SIGTERM", Set<() => void>> = {
    SIGINT: new Set(),
    SIGTERM: new Set(),
  };

  constructor(options: FakeProcessAdapterOptions = {}) {
    this.bunAvailable = options.bunAvailable ?? true;
    this.listeningProcesses = [...(options.listeningProcesses ?? [])];
    this.nextPid = options.nextPid ?? 10000;
  }

  isBunAvailable(): boolean {
    return this.bunAvailable;
  }

  findListeningProcesses(ports: number[]): ListeningProcess[] {
    return this.listeningProcesses.filter((item) => ports.includes(item.port));
  }

  spawnChild(command: string, args: string[], options: SpawnOptions): OwnedChildProcess {
    const pid = this.nextPid++;
    const child = new FakeChildProcess(pid);
    this.spawnedChildren.push({ command, args, options, child });
    return child;
  }

  killChild(child: OwnedChildProcess): void {
    if (!child || !child.pid || child.killed || child.exitCode !== null) return;
    this.signalsSent.push({ pid: child.pid, signal: "SIGTERM" });
    child.kill("SIGTERM");
  }

  onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): () => void {
    const handlers = this.signalHandlers[signal];
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  emitSignal(signal: "SIGINT" | "SIGTERM"): void {
    for (const handler of Array.from(this.signalHandlers[signal])) {
      handler();
    }
  }

  exit(code: number): void {
    this.exitCalls.push(code);
  }

  log(message: string): void {
    this.logs.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }
}

export interface LocalRunnerOptions {
  port?: number;
  forceKill?: boolean;
  dryRun?: boolean;
}

export function parseArgs(argv: string[]): LocalRunnerOptions {
  const options: LocalRunnerOptions = {
    port: DEFAULT_PORT,
    forceKill: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force-kill") {
      options.forceKill = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--port" && i + 1 < argv.length) {
      options.port = parseInt(argv[++i], 10) || DEFAULT_PORT;
    } else if (arg.startsWith("--port=")) {
      options.port = parseInt(arg.slice(7), 10) || DEFAULT_PORT;
    }
  }

  return options;
}

export async function runLocal(
  options: LocalRunnerOptions = {},
  adapter: ProcessAdapter = new NativeProcessAdapter()
): Promise<number> {
  const port = options.port || DEFAULT_PORT;
  const normalizedRoot = ROOT.replace(/\\/g, "/");

  adapter.log("\n===============================================================");
  adapter.log("🏥 GLOBAL HL7 FHIR LEARNING LAB — ZERO-DOCKER LOCAL DEV RUNNER");
  adapter.log("===============================================================");
  adapter.log(`📂 Root Workspace : ${ROOT}`);
  adapter.log(`🌐 Frontend Web App: http://localhost:${port}`);
  adapter.log(`🗄️ In-Memory DB    : PGlite WASM (27 FHIR R4 tables, Zero-Docker)`);
  adapter.log(`📚 Learning Lab    : 12 Interactive Curriculum Modules & Normalization Sandbox`);
  adapter.log(`📑 Conformance Spec: file:///${normalizedRoot}/docs/spec.md`);
  adapter.log("===============================================================\n");

  if (!adapter.isBunAvailable()) {
    adapter.error("❌ Runtime Bun tidak ditemukan di PATH. Silakan instal Bun: https://bun.sh");
    return 1;
  }

  // 1. Deteksi ketersediaan port
  adapter.log(`🔍 [1/2] Memeriksa ketersediaan port ${port}...`);
  const conflicts = adapter.findListeningProcesses([port]);
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      const isKnownDev = KNOWN_DEV_PROCESSES.some((p) => conflict.name.toLowerCase().includes(p.toLowerCase()));
      if (isKnownDev || options.forceKill) {
        adapter.warn(`   ⚠️ Port ${conflict.port} dipakai proses '${conflict.name}' (PID: ${conflict.pid}). Membersihkan...`);
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /pid ${conflict.pid} /F`, { stdio: "ignore" });
          } else {
            execSync(`kill -9 ${conflict.pid}`, { stdio: "ignore" });
          }
          adapter.log(`   ✅ Proses development zombie ${conflict.pid} berhasil dihentikan.`);
        } catch {
          adapter.error(`❌ Gagal menghentikan proses ${conflict.pid}.`);
          return 1;
        }
      } else {
        adapter.error(`❌ Port ${conflict.port} sudah digunakan oleh proses '${conflict.name}' (PID: ${conflict.pid}).`);
        adapter.error(`   Gunakan flag --force-kill jika Anda yakin ingin menghentikannya.`);
        return 1;
      }
    }
  }

  adapter.log(`   ✅ Port ${port} bersih (tidak ada konflik).`);

  if (options.dryRun) {
    adapter.log(`\n🔍 [DRY RUN] Pemeriksaan selesai. Siap menjalankan Vite dev server di port ${port}`);
    return 0;
  }

  adapter.log(`\n💻 [2/2] Menyalakan Frontend Web App (Port ${port})...\n`);

  const child = adapter.spawnChild("bun", ["run", "dev", "--port", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  child.stdout?.on("data", (data: Buffer | string) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) adapter.log(`\x1b[36m[FHIR LAB]\x1b[0m ${line}`);
    }
  });

  child.stderr?.on("data", (data: Buffer | string) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim()) adapter.error(`\x1b[33m[FHIR MSG]\x1b[0m ${line}`);
    }
  });

  const cleanup = () => {
    adapter.log("\n🛑 Menghentikan dev server lokal...");
    adapter.killChild(child);
  };

  const unhookSigint = adapter.onSignal("SIGINT", () => {
    cleanup();
    adapter.exit(0);
  });

  const unhookSigterm = adapter.onSignal("SIGTERM", () => {
    cleanup();
    adapter.exit(0);
  });

  const { promise, resolve: resolveExit } = Promise.withResolvers<number>();

  child.on("exit", (code) => {
    unhookSigint();
    unhookSigterm();
    resolveExit(code ?? 0);
  });
  child.on("error", (err) => {
    adapter.error(`❌ Terjadi error pada Vite dev server: ${err.message}`);
    unhookSigint();
    unhookSigterm();
    resolveExit(1);
  });

  return promise;
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2));
  runLocal(options).then((code) => {
    if (code !== 0) process.exit(code);
  });
}
