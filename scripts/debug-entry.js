const { spawnSync } = require("child_process");
const path = require("path");
const projectRoot = process.cwd();
const resolveScript = require.resolve("expo/scripts/resolveAppEntry");
for (const mode of ["absolute", "relative"]) {
  const r = spawnSync(process.execPath, [resolveScript, projectRoot, "android", mode], { encoding: "utf8" });
  console.log(mode, JSON.stringify(r.stdout.trim()));
  if (r.stderr) console.log("err", r.stderr.slice(0,200));
}
console.log("exists abs?", require("fs").existsSync(spawnSync(process.execPath, [resolveScript, projectRoot, "android", "absolute"], { encoding: "utf8" }).stdout.trim()));
