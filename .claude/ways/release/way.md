---
description: Release workflow — cut a GitHub release; arch-repo publishes
vocabulary: release publish aur version bump ship pkgbuild tarball
pattern: release|publish|aur|version|bump|ship
commands: create-release|make release|make package
scope: agent, subagent
---
# Release Workflow

`aaronsb/arch-repo` publishes this project. It reads `./PKGBUILD` from the
default branch, builds it in a clean container, lints with namcap, signs, and
pushes to the AUR (`mmm`) and the `[aaronsb]` pacman repository.

## Cutting a release

```bash
make package                 # clean-chroot build + namcap; fails on a namcap error
make release                 # then tag, push, and cut the GitHub release
```

That is the whole publishing action. There is no AUR step.

## Never

- Do not push to the AUR from here. `scripts/update-aur.sh` and the `aur:update`
  npm script are gone, there is no clone to keep at `~/Projects/aur/mmm`, and two
  writers to one AUR ref is how a PKGBUILD and its `.SRCINFO` drift apart.
- Do not edit `pkgver`, `pkgrel` or `sha256sums`, and do not commit a
  `.SRCINFO`. arch-repo overwrites all four.
- Do not cut a version for a packaging fix. Change the recipe on the default
  branch and arch-repo ships it as a `pkgrel` bump.

See `.claude/CLAUDE.md` for what the recipe depends on, and
https://github.com/aaronsb/arch-repo/blob/main/docs/packaging-contract.md for
the contract.
