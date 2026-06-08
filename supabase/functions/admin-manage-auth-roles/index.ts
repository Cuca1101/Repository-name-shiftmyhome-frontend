import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleAdminManageAuthRoles } from '../_shared/adminManageAuthRolesHandler.ts'

serve((req) => handleAdminManageAuthRoles(req))
