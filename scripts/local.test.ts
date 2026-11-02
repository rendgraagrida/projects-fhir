import { describe, expect, it } from "bun:test";
import {
  DEFAULT_PORT,
  FakeProcessAdapter,
  findListeningProcesses,
  parseArgs,
  parseNetstatOutput,
  runLocal,
} from "./local";
import type { ListeningProcess } from "./local";

describe("local.ts — Process Safety & Local Runner", () => {
  it("parseNetstatOutput correctly extracts LISTENING PIDs for IPv4 and IPv6", () => {
    const sampleNetstat = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       1234
  TCP    127.0.0.1:5173         127.0.0.1:54321        ESTABLISHED     9999
  TCP    [::1]:5173             [::]:0                 LISTENING       5678
  TCP    [::]:5173              [::]:0                 LISTENING       7777
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       8888
`;

    const results = parseNetstatOutput(sampleNetstat, [5173], 99999, 88888);

    expect(results).toEqual(
      expect.arrayContaining([
        { port: 5173, pid: 1234, name: "" },
        { port: 5173, pid: 5678, name: "" },
        { port: 5173, pid: 7777, name: "" },
      ])
    );

    const pids = results.map((r) => r.pid);
    expect(pids).not.toContain(9999); // ESTABLISHED ignored
    expect(pids).not.toContain(8888); // Different port
  });

  it("parseNetstatOutput ignores system PIDs (<= 4) and self/parent PID", () => {
    const sampleNetstat = `
  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       4
  TCP    [::1]:5173             [::]:0                 LISTENING       1234
`;
    const results = parseNetstatOutput(sampleNetstat, [5173], 1234, 0);
    expect(results).toEqual([]);
  });

  it("parseArgs correctly parses CLI options", () => {
    expect(parseArgs([])).toEqual({
      port: DEFAULT_PORT,
      forceKill: false,
      dryRun: false,
    });

    expect(parseArgs(["--port", "5200", "--force-kill", "--dry-run"])).toEqual({
      port: 5200,
      forceKill: true,
      dryRun: true,
    });

    expect(parseArgs(["--port=5300"])).toEqual({
      port: 5300,
      forceKill: false,
      dryRun: false,
    });
  });

  it("runLocal exits with code 1 when Bun runtime is not available", async () => {
    const adapter = new FakeProcessAdapter({ bunAvailable: false });
    const code = await runLocal({ dryRun: true }, adapter);
    expect(code).toBe(1);
    expect(adapter.errors.some((e) => e.includes("Runtime Bun tidak ditemukan"))).toBe(true);
  });

  it("runLocal in dryRun mode prints full banner, path routes, and returns 0 without spawning", async () => {
    const adapter = new FakeProcessAdapter({ bunAvailable: true });
    const code = await runLocal({ dryRun: true, port: 5173 }, adapter);

    expect(code).toBe(0);
    expect(adapter.spawnedChildren.length).toBe(0);

    // Verify banner and route information are displayed
    expect(adapter.logs.some((l) => l.includes("GLOBAL HL7 FHIR LEARNING LAB"))).toBe(true);
    expect(adapter.logs.some((l) => l.includes("📂 Root Workspace"))).toBe(true);
    expect(adapter.logs.some((l) => l.includes("🌐 Frontend Web App: http://localhost:5173"))).toBe(true);
    expect(adapter.logs.some((l) => l.includes("🗄️ In-Memory DB"))).toBe(true);
    expect(adapter.logs.some((l) => l.includes("📑 Conformance Spec"))).toBe(true);
    expect(adapter.logs.some((l) => l.includes("[1/2] Memeriksa ketersediaan port 5173"))).toBe(true);
    expect(adapter.logs.some((l) => l.includes("Port 5173 bersih"))).toBe(true);
  });

  it("runLocal warns on foreign non-dev process and exits 1 without force-kill", async () => {
    const foreignListener: ListeningProcess = {
      port: 5173,
      pid: 99123,
      name: "foreign_database.exe",
    };
    const adapter = new FakeProcessAdapter({
      bunAvailable: true,
      listeningProcesses: [foreignListener],
    });

    const code = await runLocal({ port: 5173, forceKill: false }, adapter);
    expect(code).toBe(1);
    expect(adapter.errors.some((e) => e.includes("sudah digunakan oleh proses 'foreign_database.exe'"))).toBe(true);
  });
});
