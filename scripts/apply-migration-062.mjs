#!/usr/bin/env node
/**
 * Apply driver workflow fix (migration 062) to linked Supabase project.
 * Run: npm run db:apply-062
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sqlFile = path.join(root, 'supabase', 'migrations', '062_driver_job_workflow_sync.sql')

const child = spawn(
  'npx',
  ['supabase', 'db', 'query', '--linked', '--yes', '-f', sqlFile],
  { cwd: root, stdio: 'inherit', shell: true },
)

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✓ Migration 062 applied. Driver Start/Arrived/Complete should sync to admin.')
    process.exit(0)
  }
  console.error('\n✗ CLI apply failed (often Supabase pooler circuit breaker).')
  console.error('  Paste this file in Supabase Dashboard → SQL Editor → Run:')
  console.error(`  ${sqlFile}`)
  process.exit(code ?? 1)
})
