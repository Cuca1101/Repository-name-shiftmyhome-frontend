import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCreateDriverAccount } from '../_shared/createDriverAccountHandler.ts'

serve((req) => handleCreateDriverAccount(req))
