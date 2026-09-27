from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
snap = ROOT / "operations/data/nsp-official-snapshot-2026-09.json"
data = json.loads(snap.read_text(encoding="utf-8"))
assert data["source"].startswith("https://scholarships.gov.in/")
assert data["records"], "snapshot has no records"
assert len({r["scholarship_id"] for r in data["records"]}) == len(data["records"])

required = [
    "student-app/app/scholarships/page.tsx",
    "student-app/app/dashboard/page.tsx",
    "student-app/app/applications/page.tsx",
    "student-app/app/documents/page.tsx",
    "student-app/app/applications/new/page.tsx",
    "student-app/components/jago/ChatWindow.tsx",
    "student-app/lib/api/jago.ts",
    "student-app/lib/api/http.ts",
]
for rel in required:
    assert (ROOT / rel).exists(), rel

checks = {
    "student-app/app/scholarships/page.tsx": "catch",
    "student-app/app/dashboard/page.tsx": "allSettled",
    "student-app/app/applications/page.tsx": "catch",
    "student-app/app/documents/page.tsx": "allSettled",
    "student-app/components/jago/ChatWindow.tsx": "setError",
}
for rel, needle in checks.items():
    assert needle in (ROOT / rel).read_text(encoding="utf-8"), f"missing {needle} in {rel}"

source_files = list((ROOT / "student-app").rglob("*.ts")) + list((ROOT / "student-app").rglob("*.tsx"))
missing = []
pattern = re.compile(r'''(?:from|import)\s*\(?\s*["'](\.{1,2}/[^"']+)["']''')
for p in source_files:
    source = p.read_text(encoding="utf-8", errors="ignore")
    for spec in pattern.findall(source):
        base = p.parent / spec
        candidates = [
            base,
            Path(str(base) + ".ts"),
            Path(str(base) + ".tsx"),
            Path(str(base) + ".js"),
            Path(str(base) + ".jsx"),
            base / "index.ts",
            base / "index.tsx",
        ]
        if not any(c.exists() for c in candidates):
            missing.append(f"{p.relative_to(ROOT)} -> {spec}")
assert not missing, "Missing imports:\n" + "\n".join(missing)

print(f"snapshot_records={len(data['records'])}")
print("missing_local_imports=0")
print("resilience_checks=PASS")
