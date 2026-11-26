import os, sys
sys.stdout.reconfigure(encoding="utf-8")
targets = [
  "C:/Users/Mohammed/.gemini/antigravity-ide/scratch/athar",
  "C:/Users/Mohammed/.gemini/antigravity-ide/scratch/athar-backend",
]
needles = ["مؤسسة", "مجتمع", "AI community", "مجتمع AI"]
out = open("C:/Users/Mohammed/.gemini/antigravity-ide/scratch/athar/rebrand_scan.txt", "w", encoding="utf-8")
for root in targets:
    for dirpath, _, files in os.walk(root):
        if ".git" in dirpath or "node_modules" in dirpath: continue
        for fn in files:
            if not fn.endswith((".html",".js",".ts",".md",".css",".json")): continue
            p = os.path.join(dirpath, fn)
            try:
                s = open(p, encoding="utf-8", errors="replace").read()
            except: continue
            hits = {n: s.count(n) for n in needles if n in s}
            if hits:
                out.write(p + " " + repr(hits) + "\n")
out.close()
print("done")
