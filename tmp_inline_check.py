const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, ok = true;
while ((m = re.exec(html))) {
  i++;
  try { new Function(m[1]); } catch (e) { ok = false; console.log("INLINE SCRIPT " + i + " FAILED: " + e.message); }
}
console.log("checked", i, "inline scripts; ok =", ok);
