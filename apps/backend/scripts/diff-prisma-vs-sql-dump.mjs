/**
 * Compara colunas das tabelas public.* no database.sql (pg_dump)
 * com os campos dos modelos Prisma (incl. @map).
 * Uso: node scripts/diff-prisma-vs-sql-dump.mjs [caminho/database.sql]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const sqlPath =
  process.argv[2] ||
  path.join('d:', 'sentinella', 'backup_20260415_193124', 'database', 'database.sql')

/** Extrai corpo (...) do CREATE TABLE; ignora parênteses dentro de strings SQL ('...'). */
function extractCreateTableBodies(sql) {
  const tables = {}
  const re = /CREATE TABLE public\.(\w+) \(/g
  let m
  while ((m = re.exec(sql)) !== null) {
    const name = m[1]
    // pg_dump coloca DDL antes dos dados; migrações embutidas em JSON podem repetir
    // CREATE TABLE ... — manter só a primeira ocorrência (DDL canônico).
    if (Object.prototype.hasOwnProperty.call(tables, name)) continue
    const start = m.index + m[0].length
    let depth = 1
    let j = start
    let inStr = false
    for (; j < sql.length && depth > 0; j++) {
      const c = sql[j]
      if (inStr) {
        if (c === "'" && sql[j + 1] === "'") {
          j++
          continue
        }
        if (c === "'") inStr = false
        continue
      }
      if (c === "'") {
        inStr = true
        continue
      }
      if (c === '(') depth++
      else if (c === ')') depth--
    }
    tables[name] = sql.slice(start, j - 1)
  }
  return tables
}

function isPgTypeToken(tok) {
  if (!tok) return false
  const t = tok.replace(/\([^)]*\)/g, '').replace(/^public\./, '')
  if (
    /^(uuid|text|integer|bigint|smallint|boolean|numeric|real|double|date|timestamp|jsonb|json|bytea|inet|cidr|geometry|geography|character|varchar|serial|bigserial|time)/i.test(
      t,
    )
  ) {
    return true
  }
  // Enums e domínios: public.papel_app, public.reinspecao_status, etc.
  if (/^[a-z_][a-z0-9_]*$/i.test(t) && t.length > 1) return true
  return false
}

/** Colunas físicas (pg_dump); ignora CONSTRAINT e corpo de GENERATED (CASE/WHEN/ELSE). */
function parsePgColumns(inner) {
  const cols = []
  for (const line of inner.split('\n')) {
    const raw = line.trim()
    if (!raw) continue
    const upper = raw.toUpperCase()
    if (
      upper.startsWith('CONSTRAINT ') ||
      upper.startsWith('PRIMARY KEY') ||
      upper.startsWith('UNIQUE ') ||
      upper.startsWith('FOREIGN KEY') ||
      upper.startsWith('CHECK ') ||
      upper.startsWith('EXCLUDE ')
    ) {
      continue
    }
    const kw = raw.split(/\s+/)[0]?.toUpperCase()
    if (['CASE', 'WHEN', 'ELSE', 'END'].includes(kw)) continue

    const m = /^([a-z_][a-z0-9_]*)\s+(\S+)/.exec(raw)
    if (!m) continue
    const typeTok = m[2].replace(/[,;].*$/, '')
    if (!isPgTypeToken(typeTok)) continue
    cols.push(m[1])
  }
  return cols
}

function extractModelBlocks(content) {
  const blocks = []
  const re = /\bmodel\s+(\w+)\s*\{/g
  let m
  while ((m = re.exec(content)) !== null) {
    const name = m[1]
    let depth = 1
    let j = m.index + m[0].length
    for (; j < content.length && depth > 0; j++) {
      const c = content[j]
      if (c === '{') depth++
      else if (c === '}') depth--
    }
    blocks.push({ name, body: content.slice(m.index + m[0].length, j - 1) })
  }
  return blocks
}

const PRISMA_SCALARS = new Set([
  'String',
  'Int',
  'BigInt',
  'Boolean',
  'DateTime',
  'Json',
  'Decimal',
  'Float',
  'Bytes',
])

function loadEnumNames(prismaSchemaDir) {
  const names = new Set()
  const files = fs.readdirSync(prismaSchemaDir).filter((f) => f.endsWith('.prisma'))
  for (const f of files) {
    const content = fs.readFileSync(path.join(prismaSchemaDir, f), 'utf8')
    const re = /\benum\s+(\w+)\s*\{/g
    let m
    while ((m = re.exec(content)) !== null) names.add(m[1])
  }
  return names
}

/** Primeiro token de tipo Prisma (ex.: String?, foco_risco_historico[], Unsupported("...")). */
function firstTypeToken(line) {
  const noComment = line.replace(/\/\/.*/, '').trim()
  const atIdx = noComment.search(/\s@[a-zA-Z_]/)
  const def = atIdx >= 0 ? noComment.slice(0, atIdx).trim() : noComment
  const m = /^(\w+)\s+(.+)$/.exec(def)
  if (!m) return null
  return m[2].trim().split(/\s+/)[0] ?? null
}

function isPhysicalColumnField(line, enums) {
  if (line.includes('@relation')) return false
  const typeTok = firstTypeToken(line)
  if (!typeTok) return false
  let base = typeTok.replace(/\?$/, '')
  if (base.includes('[]')) {
    const inner = base.replace(/\[\]$/, '')
    if (PRISMA_SCALARS.has(inner) || inner === 'Bytes') return true
    return false
  }
  if (base.startsWith('Unsupported')) return true
  if (base.startsWith('Decimal')) return true
  if (PRISMA_SCALARS.has(base)) return true
  if (enums.has(base)) return true
  return false
}

function loadPrismaModels(prismaSchemaDir) {
  const enums = loadEnumNames(prismaSchemaDir)
  const files = fs.readdirSync(prismaSchemaDir).filter((f) => f.endsWith('.prisma'))
  const byTable = {}

  for (const f of files) {
    const content = fs.readFileSync(path.join(prismaSchemaDir, f), 'utf8')
    for (const { name: modelName, body: block } of extractModelBlocks(content)) {
      const mapM = /@@map\("([^"]+)"\)/.exec(block)
      const tableName = mapM ? mapM[1] : modelName
      const dbColumns = []

      for (const line of block.split('\n')) {
        let ln = line.trim()
        if (!ln || ln.startsWith('@@') || ln.startsWith('//')) continue
        if (!isPhysicalColumnField(ln, enums)) continue
        const fieldM = /^(\w+)\s+/.exec(ln)
        if (!fieldM) continue
        const fieldName = fieldM[1]
        const mapField = /@map\("([^"]+)"\)/.exec(ln)
        dbColumns.push(mapField ? mapField[1] : fieldName)
      }

      byTable[tableName] = dbColumns
    }
  }
  return byTable
}

const sql = fs.readFileSync(sqlPath, 'utf8')
const bodies = extractCreateTableBodies(sql)
const dbTables = {}
for (const [name, inner] of Object.entries(bodies)) {
  dbTables[name] = parsePgColumns(inner)
}

const prismaDir = path.join(root, 'prisma', 'schema')
const prismaByTable = loadPrismaModels(prismaDir)

const prismaTables = new Set(Object.keys(prismaByTable))
const dbTableNames = new Set(Object.keys(dbTables))

const missingInDump = [...prismaTables].filter((t) => !dbTableNames.has(t))
const prismaOnlyIgnore = new Set(['my_spatial_ref_sys'])

const extraInDb = [...dbTableNames].filter(
  (t) => !prismaTables.has(t) && !prismaOnlyIgnore.has(t),
)

console.log(`SQL dump: ${sqlPath}`)
console.log(`Tabelas public no dump: ${dbTableNames.size}`)
console.log(`Tabelas com @@map no Prisma: ${prismaTables.size}`)
console.log('')

if (missingInDump.length) {
  console.log('--- Model Prisma sem tabela no dump ---')
  console.log(missingInDump.join(', '))
  console.log('')
}

if (extraInDb.length) {
  console.log('--- Tabelas no dump sem model Prisma ---')
  console.log(extraInDb.join(', '))
  console.log('')
}

console.log('--- Colunas: só no Prisma | só no DB | (iguais omitidas) ---')
let issues = 0
for (const table of [...prismaTables].sort()) {
  const dbCols = dbTables[table]
  const prCols = prismaByTable[table]
  if (!dbCols) {
    console.log(`${table}: [tabela ausente no dump]`)
    issues++
    continue
  }
  const setDb = new Set(dbCols)
  const setPr = new Set(prCols)
  const onlyPr = prCols.filter((c) => !setDb.has(c))
  const onlyDb = dbCols.filter((c) => !setPr.has(c))
  if (onlyPr.length || onlyDb.length) {
    issues++
    console.log(`\n[${table}]`)
    if (onlyPr.length) console.log(`  só Prisma: ${onlyPr.join(', ')}`)
    if (onlyDb.length) console.log(`  só DB:     ${onlyDb.join(', ')}`)
  }
}

console.log('')
console.log(issues === 0 ? 'Nenhuma divergência de colunas.' : `Total tabelas com divergência: ${issues}`)
process.exit(issues > 0 ? 1 : 0)
