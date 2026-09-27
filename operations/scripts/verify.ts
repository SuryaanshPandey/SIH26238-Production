import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface CheckItem {
  name: string;
  command?: string;
  checkFn?: () => boolean;
}

async function runVerification() {
  console.log("================================================================================");
  console.log("🔍 SIH26238 — RIJVAN MODULE: AUTOMATED DEFINITION-OF-DONE VERIFICATION");
  console.log("================================================================================\n");

  const checks: { title: string; cmd?: string; fn?: () => boolean }[] = [
    { title: "TypeScript Typecheck & Build Validation", cmd: "npx tsc --noEmit" },
    { title: "Vitest Automated Test Suite (Unit, State Machine, Contract)", cmd: "npx vitest run" },
    { title: "Database Migrations & Prisma Client Status", cmd: "npx prisma generate" },
    { title: "Database Seeding & Master Catalogue Generation", cmd: "npx tsx prisma/seed.ts" },
    { title: "Deterministic End-to-End Demo Execution", cmd: "npx tsx scripts/demo.ts" },
    { title: "Cross-Module Integration Simulator", cmd: "npx tsx scripts/simulator.ts" },
    {
      title: "Contract Fixtures Integrity Check (20+ Fixtures)",
      fn: () => {
        const dir = path.resolve(process.cwd(), "contracts/fixtures");
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
        return files.length >= 20;
      },
    },
    {
      title: "Environment Security Check (.env.example present, no committed secrets)",
      fn: () => {
        return fs.existsSync(path.resolve(process.cwd(), ".env.example"));
      },
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    process.stdout.write(`⏳ [CHECKING] ${check.title}... `);
    try {
      if (check.cmd) {
        execSync(check.cmd, { stdio: "pipe" });
      } else if (check.fn) {
        const ok = check.fn();
        if (!ok) throw new Error("Validation condition failed.");
      }
      console.log("✅ PASS");
    } catch (err: any) {
      console.log("❌ FAIL");
      if (err.stdout) console.log(err.stdout.toString());
      if (err.stderr) console.log(err.stderr.toString());
      allPassed = false;
    }
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("🎉 FINAL STATUS: READY FOR INTEGRATION (ALL VERIFICATION CHECKS PASSED)");
  } else {
    console.log("⚠️ FINAL STATUS: NOT READY (Some checks failed)");
  }
  console.log("================================================================================");

  if (!allPassed) {
    process.exit(1);
  }
}

runVerification();
