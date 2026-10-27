# Scratch (PR-only): disassemble named functions inside a Metro module.  python3 tests/bench/scratch/dis.py 4750 can
import sys; sys.path.insert(0,'scripts/hbc')
from hbc import Bundle
B=Bundle('work/new/assets/index.android.bundle')
mod=int(sys.argv[1]); names=sys.argv[2:]
for f in B.tree(mod):
    if B.h.fname(f) in names:
        print('== fn', f, B.h.fname(f)); print('\n'.join(B.h.dis(B.h.func(f))))
