from pathlib import Path
import re
import sys

DYNAMIC = re.compile(r"^\[(.+)\]$")


def check_app(app_root: Path) -> list[str]:
    errors: list[str] = []
    groups: dict[tuple[str, ...], list[Path]] = {}
    for p in app_root.rglob("*"):
        if not p.is_dir():
            continue
        rel = p.relative_to(app_root)
        parts = rel.parts
        if not parts:
            continue
        # Only directories that contain a Next.js route file matter.
        if not any((p / filename).exists() for filename in ("page.tsx", "page.ts", "route.ts", "route.js", "route.tsx")) and not any(x in parts for x in ("api",)):
            continue
        normalized = tuple("[]" if DYNAMIC.fullmatch(part) else part for part in parts)
        groups.setdefault(normalized, []).append(rel)

    for key, paths in groups.items():
        if len(paths) <= 1:
            continue
        dynamic_positions = [i for i, part in enumerate(key) if part == "[]"]
        if not dynamic_positions:
            continue
        names = [str(p).replace("\\", "/") for p in paths]
        errors.append(f"Dynamic route collision under /{'/'.join(key)}: {sorted(names)}")
    return errors


def main() -> int:
    errors: list[str] = []
    for name in ("operations/src/app", "student-app/app"):
        app_root = Path(name)
        if app_root.exists():
            errors.extend(f"{name}: {e}" for e in check_app(app_root))
    if errors:
        print("\n".join(errors))
        return 1
    print("Next.js dynamic route validation: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
