/**
 * Post-deploy checklist for admin-create-driver (manual verification).
 *
 * 1. Admin signed in at /admin/drivers → Add Driver
 * 2. Supabase Dashboard → Authentication → Users: new email appears
 * 3. Table Editor → drivers: row with matching user_id, full_name, email, active
 * 4. Mobile: signInWithPassword → resolveDriverAccessAfterLogin (driverAuthSession.js)
 *
 * Usage (optional env check after create):
 *   node scripts/verify-driver-account-create.mjs <driver_id> <expected_auth_user_id>
 */

const driverId = process.argv[2]
const expectedUserId = process.argv[3]

if (!driverId || !expectedUserId) {
  console.log(`
Verify driver account creation (manual steps):

  Admin UI:
    - /admin/drivers → "Add Driver"
    - Success: driver id + auth user id shown

  Supabase Dashboard:
    - Authentication → Users: email exists, confirmed
    - public.drivers: user_id column = same UUID as Auth user id

  Mobile (separate app):
    - signInWithPassword(email, temp password)
    - fetch drivers where user_id = session.user.id
    - active=true → access; active=false → "Driver account inactive"
    - no row → "No driver profile found"

  Edge Function:
    - Deploy: supabase functions deploy admin-create-driver
    - Legacy alias: supabase functions deploy create-driver-account
    - Optional secret: ADMIN_AUTH_EMAILS=admin@yourcompany.com

  Re-run with IDs to compare strings:
    node scripts/verify-driver-account-create.mjs <driver_id> <auth_user_id>
`)
  process.exit(0)
}

if (driverId === expectedUserId) {
  console.log('OK: driver id and auth user id match (as expected when passed same UUID).')
} else {
  console.log('Compare in Supabase: drivers.id =', driverId)
  console.log('                 drivers.user_id should =', expectedUserId)
}
