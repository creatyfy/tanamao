import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gera access token OAuth2 para FCM v1
async function getFCMAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }))

  const signingInput = `${header}.${payload}`

  // Importa chave privada RSA
  const pemKey = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { notificationId, title, body, targetType, targetCity, storeId, tokens: directTokens, data } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca tokens conforme o target
    let query = supabase
      .from('push_tokens')
      .select('token, users:user_id(role, addresses(city))')

    if (targetType === 'clients') {
      query = supabase
        .from('push_tokens')
        .select('token, users:user_id(role)')
        .eq('users.role', 'client')
    } else if (targetType === 'city' && targetCity) {
      // Busca clientes da cidade
      const { data: cityUsers } = await supabase
        .from('addresses')
        .select('user_id')
        .ilike('city', `%${targetCity}%`)

      const userIds = cityUsers?.map((a: any) => a.user_id) || []

      query = supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', userIds)
    } else if (targetType === 'specific_tokens' && Array.isArray(directTokens)) {
      query = supabase.from('push_tokens').select('token').in('token', directTokens)
    } else if (targetType === 'couriers') {
      const { data: courierUsers } = await supabase
        .from('couriers')
        .select('user_id')
      const userIds = courierUsers?.map((c: any) => c.user_id) || []
      query = supabase.from('push_tokens').select('token').in('user_id', userIds)
    } else if (targetType === 'stores') {
      const { data: storeUsers } = await supabase
        .from('stores')
        .select('owner_id')
      const userIds = storeUsers?.map((s: any) => s.owner_id) || []
      query = supabase.from('push_tokens').select('token').in('user_id', userIds)
    }

    const { data: tokenRecords } = await query
    const tokens = (tokenRecords || []).map((r: any) => r.token).filter(Boolean)

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Pega credenciais Firebase
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)
    const projectId = serviceAccount.project_id
    const accessToken = await getFCMAccessToken(serviceAccount)

    // Envia para cada token
    let sentCount = 0
    const batchSize = 100

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize)

      await Promise.allSettled(batch.map(async (token: string) => {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: Object.fromEntries(
                  Object.entries(data || {}).map(([key, value]) => [key, String(value)])
                ),
                android: {
                  priority: 'HIGH',
                  notification: {
                    sound: 'default',
                    channelId: 'high_importance_channel',
                  }
                },
                apns: {
                  headers: { 'apns-priority': '10' },
                  payload: {
                    aps: { sound: 'default', badge: 1 }
                  }
                }
              }
            })
          }
        )
        if (res.ok) sentCount++
      }))
    }

    // Atualiza status da notificação no banco
    if (notificationId) {
      await supabase.from('notifications').update({
        status: 'sent',
        sent_count: sentCount,
        sent_at: new Date().toISOString(),
      }).eq('id', notificationId)
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, total: tokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('send-push error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
