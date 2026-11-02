import { describe, expect, it } from "bun:test";
import { main, type ProductionRunner } from "./deploy-prod";

describe("deploy-prod safety tests", () => {
  it("rejects duplicate arguments", () => {
    const code = main(["--dry-run", "--dry-run"], { log: () => {} });
    expect(code).toBe(1);
  });

  it("rejects empty reason", () => {
    const code = main(["--reason="], { log: () => {} });
    expect(code).toBe(1);
  });

  it("rejects non-main branches", () => {
    const run: ProductionRunner = (file, args) => {
      if (args[0] === "branch") return { status: 0, stdout: "development", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    const code = main([], { run, log: () => {} });
    expect(code).toBe(1);
  });

  it("rejects dirty working tree", () => {
    const run: ProductionRunner = (file, args) => {
      if (args[0] === "branch") return { status: 0, stdout: "main", stderr: "" };
      if (args[0] === "status") return { status: 0, stdout: " M dirty-file.ts", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    const code = main([], { run, log: () => {} });
    expect(code).toBe(1);
  });

  it("accepts dry-run on clean main branch", () => {
    const run: ProductionRunner = (file, args) => {
      if (args[0] === "branch") return { status: 0, stdout: "main", stderr: "" };
      if (args[0] === "status") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "rev-parse") return { status: 0, stdout: "a".repeat(40), stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    let logged = "";
    const code = main(["--dry-run"], { run, log: (msg) => { logged += msg; } });
    expect(code).toBe(0);
    expect(logged).toContain("[dry-run] Would dispatch");
  });
});
