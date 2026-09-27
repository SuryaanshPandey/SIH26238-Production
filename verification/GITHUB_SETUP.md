# GitHub Setup

Recommended repository name: `SIH26238-Documents-Verification`

## First push

```powershell
git init
git branch -M main
git add .
git status
git commit -m "feat: initial Documents and Verification Intelligence module"
git remote add origin https://github.com/<YOUR_USERNAME>/SIH26238-Documents-Verification.git
git push -u origin main
```

## Before pushing

- Confirm `.env` is not present.
- Confirm no SQLite database file is staged.
- Review `git status`.

## Run checks locally

```powershell
pytest -q
python scripts_persistent_smoke.py
```
