import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'src')
const TARGET_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md'])

// Match common UTF-8 mojibake fragments (safer than raw "Ã" which appears in valid words like "ĐÃ").
const BAD_REGEXES = [
  /Ã[\u0080-\u00BF]/u,
  /Æ[\u0080-\u00BF]/u,
  /Ä[\u0080-\u00BF]/u,
  /Â[\u0080-\u00BF]/u,
  /á[\u0080-\u00BF]/u,
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
      continue
    }
    const ext = path.extname(name).toLowerCase()
    if (TARGET_EXT.has(ext)) out.push(full)
  }
  return out
}

const files = walk(ROOT)
const findings = []

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const bad = BAD_REGEXES.find((rx) => rx.test(line))
    if (bad) {
      findings.push({
        file,
        line: i + 1,
        snippet: line.trim().slice(0, 200),
        pattern: bad.toString(),
      })
    }
  }
}

if (findings.length > 0) {
  console.error(`Found ${findings.length} potential mojibake issue(s) in src:`)
  for (const f of findings) {
    const rel = path.relative(process.cwd(), f.file)
    console.error(`- ${rel}:${f.line} [${f.pattern}] ${f.snippet}`)
  }
  process.exit(1)
}

console.log('Mojibake check passed: no suspicious UTF-8 corruption found in src.')
