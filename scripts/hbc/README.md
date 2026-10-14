# HBC98 inspection and porting helpers

Developer-only tools for inspecting Discord's Hermes bytecode (`HBC98` / `hermes-v250829098.0.19`) and porting Venus Patches to a new Discord Android build. Nothing here is shipped in the `.mpp`.

## Quick start (extracting a new Discord `.apkm`)

```bash
mkdir -p work/new
unzip -p Discord.apkm base.apk > work/new/base.apk
unzip -o work/new/base.apk assets/index.android.bundle -d work/new
```

## 1. Automated version-upgrade audit (`port_check.py`)

Run `port_check.py` against the new bundle first:

```bash
python3 scripts/hbc/port_check.py work/new/assets/index.android.bundle
```

It prints:
1. **Bundle & Global `#0` constants** ready to paste into `HbcPrivacy.kt` (`ORIGINAL_SHA256`) and `HbcPrelude.kt` (`FUNCTION_COUNT`, `GLOBAL_OFFSET`, `GLOBAL_SIZE`, `GLOBAL_SHA256`, `JOIN_ID`, `EVAL_ID`, `PROMISE_ID`, `RESOLVE_ID`, `EMPTY_ID`).
2. **Bootstrap Metro module verification** across all 120 Metro modules hooked or demand-loaded by `bootstrap.js`. If any module ID shifted in the new Discord build, `port_check.py` automatically searches for its new ID by embedded `fileFinishedImporting` source path and exported identifier strings.
3. **HbcPrivacy target verification** across all 104 pinned HBC98 functions (`analytics`, `telemetry`, `crash`), reporting any shifted function IDs along with auto-located candidates in the new bundle.

## 2. Regenerating `HbcPrivacy.kt` target tables (`privacy_targets.py`)

Once `port_check.py` shows the new function IDs (or using `--locate` to auto-resolve functions by `(module_path, function_name)`):

```bash
python3 scripts/hbc/privacy_targets.py work/new/assets/index.android.bundle --locate
```

This verifies that every target function has an expanded header (`flags & 0x20 != 0`) and no exception handler table (`flags & 0xc8 == 0`), and outputs the exact `Target(...)` Kotlin lists with compact header hex, body SHA-256, and expanded header SHA-256 for `HbcPrivacy.kt`.

## 3. Interactive bundle inspection (`hbc.py`)

```bash
python3 -c "
import sys; sys.path.insert(0, 'scripts/hbc')
from hbc import Bundle
B = Bundle('work/new/assets/index.android.bundle')
print(B.grep_path('UserStore'))
print(B.show(1378))
print('\n'.join(B.h.dis(B.h.func(B.modules[1378]))[:40]))
"
```

- `ops.txt` is the HBC98 opcode table, generated from Hermes' `BytecodeList.def` (tag `hermes-v250829098.0.19`).
- `Bundle` maps Metro module IDs to factory function IDs (`B.modules`), dependency arrays (`B.deps`), source paths (`B.paths()`), referenced strings (`B.strs(mid, deep=True)`), exported property names (`B.exports(mid)`), and closure trees (`B.tree(mid)`).
