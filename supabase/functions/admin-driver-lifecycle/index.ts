import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleAdminDriverLifecycle } from '../_shared/adminDriverLifecycleHandler.ts'

serve((req) => handleAdminDriverLifecycle(req))
