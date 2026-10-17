/**
 * Tests for the offline parser — the default path when no LLM is configured,
 * so it carries the app on its own and is worth pinning down.
 *
 * Bundles the TypeScript source with esbuild (already present via Vite) and
 * runs the cases through it. No test framework needed.
 *
 *   npm test
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const workDir = mkdtempSync(join(tmpdir(), 'xpenz-test-'))
const outfile = join(workDir, 'parse.mjs')

await build({
  entryPoints: [join(root, 'src', 'lib', 'parse.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
})

const { parseLocal } = await import(pathToFileURL(outfile).href)

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOffset = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return iso(d)
}

/** [input, expected movements] — an empty array means "record nothing". */
const cases = [
  // Amount notation
  ['café 1.200', [{ amount: 1200, kind: 'gasto', category: 'Comida' }]],
  ['nafta 15 mil', [{ amount: 15000, kind: 'gasto', category: 'Transporte' }]],
  ['gasté 2 lucas en el bar', [{ amount: 2000, kind: 'gasto', category: 'Comida' }]],
  ['alquiler 620.000', [{ amount: 620000, kind: 'gasto', category: 'Hogar' }]],
  ['1.200,50 de peaje', [{ amount: 1200.5, kind: 'gasto', category: 'Transporte' }]],
  ['un palo de auto', [{ amount: 1000000, kind: 'gasto' }]],

  // Numbers written out
  ['dos mil de propina', [{ amount: 2000, kind: 'gasto' }]],
  ['mil quinientos de estacionamiento', [{ amount: 1500, kind: 'gasto', category: 'Transporte' }]],
  ['cien mil de expensas', [{ amount: 100000, kind: 'gasto', category: 'Hogar' }]],
  ['dos millones del auto', [{ amount: 2000000, kind: 'gasto' }]],

  // Income detection
  ['cobré 180000 del freelance', [{ amount: 180000, kind: 'ingreso', category: 'Trabajo' }]],
  ['me devolvieron 5000', [{ amount: 5000, kind: 'ingreso' }]],
  ['me entraron 300 mil', [{ amount: 300000, kind: 'ingreso' }]],
  ['sueldo 1.450.000', [{ amount: 1450000, kind: 'ingreso', category: 'Trabajo' }]],

  // Categories that used to fall through to "Otros"
  ['compré en Coto 45000', [{ amount: 45000, kind: 'gasto', category: 'Comida' }]],
  ['carrefour 32000', [{ amount: 32000, kind: 'gasto', category: 'Comida' }]],
  ['uber 4500', [{ amount: 4500, kind: 'gasto', category: 'Transporte' }]],
  ['farmacia 9800', [{ amount: 9800, kind: 'gasto', category: 'Salud' }]],
  ['netflix 5900', [{ amount: 5900, kind: 'gasto', category: 'Ocio' }]],

  // Dates
  ['ayer farmacia 9800', [{ amount: 9800, date: dayOffset(-1) }]],
  ['anteayer nafta 12000', [{ amount: 12000, date: dayOffset(-2) }]],

  // Several movements in one message
  ['super 8.400 y nafta 15000', [{ amount: 8400 }, { amount: 15000 }]],
  ['spotify 3.500 y netflix 5.900', [{ amount: 3500 }, { amount: 5900 }]],

  // "+" is ambiguous: separator after an amount, income marker before one.
  // Both shapes are exercised because telling them apart is the subtle part.
  ['+3000', [{ amount: 3000, kind: 'ingreso' }]],
  ['prestamo male +3000', [{ amount: 3000, kind: 'ingreso' }]],
  ['sueldo +1.450.000', [{ amount: 1450000, kind: 'ingreso' }]],
  ['+2 lucas de propina', [{ amount: 2000, kind: 'ingreso' }]],
  ['café 1200 + nafta 500', [{ amount: 1200, kind: 'gasto' }, { amount: 500, kind: 'gasto' }]],

  // Categories added later
  ['zari veterinaria 45000', [{ amount: 45000, category: 'Mascotas' }]],
  ['hamburguesa 12000', [{ amount: 12000, category: 'Comida' }]],

  // Loans between people: kind is the cash direction, person carries the debt
  ['le presté 20k a Juan', [{ amount: 20000, kind: 'gasto', person: 'Juan', category: 'Préstamos' }]],
  ['presté 5 lucas a martina', [{ amount: 5000, kind: 'gasto', person: 'Martina' }]],
  ['le presté a Juan Pérez 15000', [{ amount: 15000, kind: 'gasto', person: 'Juan Pérez' }]],
  ['juan me devolvió 5k', [{ amount: 5000, kind: 'ingreso', person: 'Juan' }]],
  ['me devolvió Juan 3.000 ayer', [{ amount: 3000, kind: 'ingreso', person: 'Juan', date: dayOffset(-1) }]],
  ['Pedro me prestó 10k', [{ amount: 10000, kind: 'ingreso', person: 'Pedro' }]],
  ['me prestó pedro 2 lucas', [{ amount: 2000, kind: 'ingreso', person: 'Pedro' }]],
  ['le devolví 10k a Pedro', [{ amount: 10000, kind: 'gasto', person: 'Pedro' }]],
  ['le presté 5k a Juan y café 1200', [{ amount: 5000, person: 'Juan' }, { amount: 1200, kind: 'gasto', person: null, category: 'Comida' }]],
  ['me devolvieron 3k', [{ amount: 3000, kind: 'ingreso', person: null }]],
  ['el cliente me pagó 50k', [{ amount: 50000, kind: 'ingreso', person: null }]],
  ['le presté 20k', []],

  // Must record nothing rather than guess
  ['hola', []],
  ['dos cafés', []],
  ['cuánto gasté este mes?', []],
]

let failures = 0

for (const [input, expected] of cases) {
  const got = parseLocal(input).movements
  const problems = []

  if (got.length !== expected.length) {
    problems.push(`esperaba ${expected.length} movimiento(s), dio ${got.length}`)
  } else {
    expected.forEach((e, i) => {
      const g = got[i]
      if (e.amount !== undefined && Math.abs(g.amount - e.amount) > 0.01)
        problems.push(`monto ${g.amount} ≠ ${e.amount}`)
      if (e.kind && g.kind !== e.kind) problems.push(`tipo "${g.kind}" ≠ "${e.kind}"`)
      if (e.category && g.category !== e.category)
        problems.push(`categoría "${g.category}" ≠ "${e.category}"`)
      if (e.date && g.date !== e.date) problems.push(`fecha ${g.date} ≠ ${e.date}`)
      if (e.person !== undefined && (g.person ?? null) !== e.person)
        problems.push(`persona "${g.person ?? ''}" ≠ "${e.person ?? ''}"`)
    })
  }

  if (problems.length === 0) {
    console.log(`  ok    ${input}`)
  } else {
    failures++
    console.log(`  FALLA ${input}`)
    for (const p of problems) console.log(`          ${p}`)
    for (const g of got) console.log(`          → ${g.kind} ${g.amount} ${g.category} "${g.description}"`)
  }
}

rmSync(workDir, { recursive: true, force: true })

console.log(`\n${cases.length - failures}/${cases.length} pasan`)
process.exit(failures === 0 ? 0 : 1)
