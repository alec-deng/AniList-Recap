#!/usr/bin/env node
// Builds and packages the extension for both Chrome and Firefox.
// Usage: node scripts/build-all.mjs
import { execSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { join } from "node:path"

const targets = [
  { name: "Chrome", flag: "", zip: "build/chrome-mv3-prod.zip" },
  { name: "Firefox", flag: " --target=firefox-mv3", zip: "build/firefox-mv3-prod.zip" }
]

function run(command) {
  console.log(`\n> ${command}`)
  execSync(command, { stdio: "inherit" })
}

for (const target of targets) {
  console.log(`\n=== ${target.name} ===`)
  run(`npx plasmo build${target.flag}`)
  run(`npx plasmo package${target.flag}`)
}

console.log("\n=== Done ===")
for (const target of targets) {
  const path = join(process.cwd(), target.zip)
  if (!existsSync(path)) {
    console.log(`${target.name}: MISSING (${target.zip})`)
    continue
  }
  const kb = (statSync(path).size / 1024).toFixed(0)
  console.log(`${target.name}: ${target.zip} (${kb} KB)`)
}
