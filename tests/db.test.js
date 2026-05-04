const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('db schema exists', () => {
  const dbPath = path.join(process.cwd(), 'data', 'db.json')
  const raw = fs.readFileSync(dbPath, 'utf8')
  const db = JSON.parse(raw)

  assert.ok(Array.isArray(db.assets))
  assert.ok(Array.isArray(db.transactions))
  assert.ok(Array.isArray(db.history))
  assert.ok(Array.isArray(db.users))
})
