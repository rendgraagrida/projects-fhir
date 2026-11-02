import { describe, expect, it } from "bun:test";
import { runCommand } from "./ci";

describe("CI Gate Harness", () => {
  it("runCommand executes standard echo command and captures output", async () => {
    const res = await runCommand([process.execPath, "-e", "console.log('ci-test-ok')"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe("ci-test-ok");
  });

  it("runCommand captures failure exit code properly", async () => {
    const res = await runCommand([process.execPath, "-e", "process.exit(2)"]);
    expect(res.exitCode).toBe(2);
  });
});
