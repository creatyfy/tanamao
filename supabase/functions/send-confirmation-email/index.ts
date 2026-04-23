import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()

    // Auth Hook payload do Supabase
    const { user, email_data } = payload
    const email = user?.email
    const confirmationUrl = email_data?.confirmation_url

    if (!email || !confirmationUrl) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const role = user?.user_metadata?.role as string | undefined
    const isStoreOrCourier = role === 'store_owner' || role === 'courier'
    const completionLabel = role === 'store_owner' ? 'da loja' : 'de motoboy'
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Tá Na Mão <noreply@tanamao.website>',
        to: [email],
        subject: 'Confirme seu cadastro no Tá Na Mão',
        html: `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          </head>
          <body style="margin:0;padding:0;background:#f0fdf4;font-family:'Inter',Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#052e10 0%,#14532d 40%,#16a34a 100%);padding:40px 32px;text-align:center;">
                        <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">Tá Na Mão</h1>
                        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Delivery rápido na sua mão 🛵</p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:40px 32px;text-align:center;">
                        <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
                          <span style="font-size:32px;">✉️</span>
                        </div>
                        <h2 style="margin:0 0 12px;color:#14532d;font-size:22px;font-weight:800;">Confirme seu email</h2>
                        <p style="margin:0 0 12px;color:#6b7280;font-size:15px;line-height:1.6;">
                          Clique no botão abaixo para confirmar seu cadastro no <strong style="color:#14532d;">Tá Na Mão</strong>.
                        </p>
                        ${isStoreOrCourier ? `
                        <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 14px;">
                          Após confirmar, volte ao app em <strong>tanamao.website/app</strong>, faça login e conclua seu cadastro ${completionLabel}.
                        </p>` : `
                        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                          Depois da confirmação, você já poderá acessar sua conta normalmente.
                        </p>`}
                        <a href="${confirmationUrl}" 
                           style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;border-radius:50px;padding:16px 40px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                          Confirmar Email
                        </a>
                        <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
                          Ou copie e cole este link no seu navegador:<br/>
                          <a href="${confirmationUrl}" style="color:#16a34a;word-break:break-all;font-size:12px;">${confirmationUrl}</a>
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #f0fdf4;">
                        <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                          Se você não criou uma conta no Tá Na Mão, ignore este email.<br/>
                          Este link expira em 24 horas.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Email enviado:', data)
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('send-confirmation-email error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
