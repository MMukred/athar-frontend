import os
roots = [
  "C:/Users/Mohammed/.gemini/antigravity-ide/scratch/athar",
  "C:/Users/Mohammed/.gemini/antigravity-ide/scratch/athar-backend",
]
# unicode escapes (ASCII source)
moassasa = "\u0645\u0624\u0633\u0633\u0629"   # مؤسسة
mujtamaa = "\u0645\u062c\u062a\u0645\u0639"   # مجتمع
akad = "\u0623\u0643\u0627\u062f\u064a\u0645\u064a\u0629 \u0623\u062b\u0631"  # أكاديمية أثر
phrases = [
  moassasa + " " + "\u0623\u062b\u0631",          # مؤسسة أثر
  moassasa + " " + "\u0623\u062b\u0631" + " " + "\u0644\u0644\u0639\u0645\u0644" + " " + mujtamaa,  # مؤسسة أثر للعمل المجتمعي
  mujtamaa + " " + "\u0623\u062b\u0631",          # مجتمع أثر
  "AI community", "مجتمع AI",
]
out = open("C:/Users/Mohammed/.gemini/antigravity-ide/scratch/athar/phrase_scan.txt", "w", encoding="utf-8")
for root in roots:
    for dirpath, _, files in os.walk(root):
        if ".git" in dirpath or "node_modules" in dirpath or "dist" in dirpath: continue
        for fn in files:
            if not fn.endswith((".html",".js",".ts",".md",".css",".json")): continue
            p = os.path.join(dirpath, fn)
            try:
                s = open(p, encoding="utf-8").read()
            except: continue
            hits = {}
            for ph in phrases:
                c = s.count(ph)
                if c: hits[ph] = c
            if hits:
                out.write(p + " " + repr(hits) + "\n")
out.close()
print("done")
