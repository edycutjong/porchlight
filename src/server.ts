import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CONFIG, MODE } from './config.js'
import { board } from './board.js'
import { load } from './db.js'
import { processCancellation } from './engine/exitInterview.js'
import { applyChange } from './engine/triggerEngine.js'

const app = express()
app.use(express.json())
app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), '..', 'public')))

app.get('/api/state', (_req, res) => {
  res.json({ mode: MODE, board: board(), roster: load().members })
})

app.post('/api/cancel', async (req, res) => {
  try {
    res.json(await processCancellation(String(req.body.memberId), req.body.message))
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.post('/api/change', async (req, res) => {
  try {
    res.json(await applyChange(String(req.body.text ?? '')))
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.listen(CONFIG.port, () => {
  console.log(`Porchlight [${MODE}] — http://localhost:${CONFIG.port}`)
  if (CONFIG.mock) console.log('  (MOCK mode — set MINDS_BUILDER_API_KEY to drive a real Mind)')
})
