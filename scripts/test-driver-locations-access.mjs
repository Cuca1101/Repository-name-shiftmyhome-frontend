/**
 * Smoke-test Supabase RLS as anon (no session) vs driver_locations visibility.
 * Run: node scripts/test-driver-locations-access.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = 'https://msjhkfdqogymkartariq.supabase.co'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zamhrZmRxb2d5bWthcnRhcmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTYzODgsImV4cCI6MjA5MzQ5MjM4OH0.Fwz-jKSxzMIEzB4ovB-5hUQM9ERXo9sIVARIm-I-XVQ'

const client = createClient(url, anon)

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  console.log('1) Anon select driver_locations (expect 0 rows / error):')
  const anonRes = await client.from('driver_locations').select('driver_id').limit(5)
  console.log('   rows:', anonRes.data?.length ?? 0, 'error:', anonRes.error?.message ?? 'none')

  if (!email || !password) {
    console.log('\nSet ADMIN_EMAIL and ADMIN_PASSWORD to test admin session RLS.')
    return
  }

  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) {
    console.error('Sign-in failed:', signIn.error.message)
    process.exit(1)
  }

  const role = signIn.data.user?.app_metadata?.role
  console.log('\n2) Signed in as', email, 'app_metadata.role =', role)

  const loc = await client.from('driver_locations').select('driver_id, latitude, longitude, updated_at').limit(10)
  console.log('   driver_locations rows:', loc.data?.length ?? 0, 'error:', loc.error?.message ?? 'none')
  if (loc.data?.length) {
    console.log('   sample:', loc.data[0])
  }

  const ja = await client
    .from('job_assignments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('quote_id', '00000000-0000-0000-0000-000000000000')
    .select('quote_id')
  console.log('\n3) job_assignments update test (fake id):', ja.error?.message ?? 'ok (admin can update)')

  await client.auth.signOut()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
