import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("student app local API imports", () => {
  it("keeps government API config import pointing to the shared config", () => {
    expect(existsSync(resolve(process.cwd(), "lib/config.ts"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "lib/api/government.ts"))).toBe(true);
  });
});
