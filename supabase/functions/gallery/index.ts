// Couple gallery: validates the token (gallery RPC) and returns short-lived signed URLs.
// Deploy with --no-verify-jwt: the gallery token is the auth, and new publishable keys aren't JWTs.
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { token } = await req.json().catch(() => ({}))
  if (typeof token !== 'string' || token.length > 100) return reply({ error: 'not_found' }, 404)

  const { data, error } = await sb.rpc('gallery', { p_token: token })
  if (error) {
    const known = ['not_found', 'expired'].includes(error.message)
    return reply({ error: known ? error.message : 'error' }, error.message === 'expired' ? 410 : known ? 404 : 500)
  }

  const items = [...data.wishes, ...data.photos]
  if (items.length) {
    const { data: urls, error: e2 } = await sb.storage.from('media').createSignedUrls(items.map((i) => i.path), 3600)
    if (e2) return reply({ error: 'error' }, 500)
    items.forEach((it, i) => {
      it.url = urls[i].signedUrl
      it.ext = it.path.split('.').pop()
      delete it.path
    })
  }
  return reply(data)
})
