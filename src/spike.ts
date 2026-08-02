import { spike } from './minds.js'
import { CONFIG, MODE } from './config.js'

// SDK-first: prove the Minds client-lib round-trip before any product code matters.
const rows = await spike()
console.log(`\nPorchlight — Minds SDK spike [${MODE}]\n`)
for (const r of rows) console.log(`  ${r.ok ? '✓' : '✗'} ${r.step.padEnd(20)} ${r.note}`)

if (CONFIG.mock) {
  console.log(`\nMOCK mode (no Builder API key). To run LIVE against a real Mind:`)
  console.log(`  1. Create a Mind at https://hellominds.ai`)
  console.log(`  2. Author the "Porchlight" Skill by describing it to the Mind (see README)`)
  console.log(`  3. Create a Builder API key at https://build.hellominds.ai (Builder console)`)
  console.log(`  4. export MINDS_BUILDER_API_KEY=...   (optionally MIND_ID=...)`)
  console.log(`  5. npm run spike\n`)
} else {
  const failed = rows.filter((r) => !r.ok)
  console.log(failed.length ? `\n${failed.length} call(s) failed — check key/mind.\n` : `\nAll 6 calls OK against a live Mind.\n`)
}
