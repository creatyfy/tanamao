import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Valida que a requisição vem realmente do Asaas
    const asaasToken = req.headers.get('asaas-access-token')
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
    if (!asaasToken || !expectedToken || asaasToken !== expectedToken) {
      console.error('Webhook: token inválido ou ausente')
      return new Response('Unauthorized', { status: 401 })
    }

    const payload = await req.json()
    const { event, payment } = payload

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: paymentRecord } = await supabase
      .from('payments')
      .select('order_id')
      .eq('asaas_payment_id', payment.id)
      .single()

    if (!paymentRecord) return new Response('Not found', { status: 404 })

    const orderId = paymentRecord.order_id

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      await supabase.from('payments').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      }).eq('asaas_payment_id', payment.id)

      await supabase.from('orders').update({
        payment_status: 'confirmed'
      }).eq('id', orderId)

    } else if (event === 'PAYMENT_OVERDUE') {
      await supabase.from('payments').update({ status: 'overdue' }).eq('asaas_payment_id', payment.id)
      await supabase.from('orders').update({
        status: 'cancelled',
        cancelled_by: 'system',
        cancel_reason: 'Pagamento não realizado no prazo',
        payment_status: 'overdue'
      }).eq('id', orderId).eq('status', 'pending')

    } else if (event === 'PAYMENT_REFUNDED') {
      await supabase.from('payments').update({ status: 'refunded' }).eq('asaas_payment_id', payment.id)
    }

    return new Response('OK', { status: 200 })

  } catch (error: any) {
    console.error('webhook error:', error)
    return new Response('Error', { status: 500 })
  }
})
