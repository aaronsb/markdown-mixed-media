---
keywords: release|publish|aur|version|bump|ship
commands: create-release|update-aur|make release|make aur
---
# Release Workflow

## Full Release

```bash
make release VERSION=1.0.x   # Tag + GitHub release + AUR update
```

Or step by step:
```bash
make build                                    # Compile
make test-pdf                                 # Verify rendering
npm run release:create -- -v 1.0.x -p         # GitHub release
npm run aur:update -- -p                      # AUR push
```

## AUR Repo

- Lives at `~/Projects/aur/mmm` (or `$AUR_REPO_DIR`)
- Must have existing history from AUR remote — don't re-init
- If push rejected: `cd ~/Projects/aur/mmm && git pull --rebase` then retry
- Script auto-generates `.SRCINFO` from PKGBUILD

## Version Flow

1. Code lands on main
2. `create-release.sh` tags, pushes, creates GitHub release with auto-generated notes
3. `update-aur.sh` downloads tarball, checksums it, updates PKGBUILD, pushes to AUR
4. Users get it via `yay -Syu mmm`

## Checksums

GitHub creates an immutable tarball per tag. The checksum is deterministic — calculate once, never changes.
