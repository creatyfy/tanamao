import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const toCents = (value: number) => Math.round((Number(value) || 0) * 100)
const fromCents = (valueInCents: number) => Number((valueInCents / 100).toFixed(2))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { orderId, method, cardToken, cardData, savedCardData } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        users:client_id(id, name, email, phone, asaas_customer_id, cpf),
        stores(name, commission_rate, asaas_wallet_id),
        deliveries(courier_earning, couriers(asaas_wallet_id))
      `)
      .eq('id', orderId)
      .single()

    if (!order) throw new Error('Pedido não encontrado')

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL')!

    let customerId = order.users?.asaas_customer_id

    if (!customerId) {
      const customerPayload: any = {
        name: order.users?.name,
        email: order.users?.email,
        mobilePhone: order.users?.phone,
      }
      
      if (order.users?.cpf) {
        customerPayload.cpfCnpj = order.users.cpf.replace(/\D/g, '')
      }

      const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: JSON.stringify(customerPayload)
      })

      const customerData = await customerRes.json()
      if (!customerRes.ok) throw new Error(`Erro ao criar cliente no Asaas: ${JSON.stringify(customerData)}`)
      
      customerId = customerData.id

      // Salva o ID do cliente no banco para futuras compras
      await supabase.from('users').update({ asaas_customer_id: customerId }).eq('id', order.users.id)
    }

    const storeWalletId = order.stores?.asaas_wallet_id
    const courierWalletId = order.deliveries?.[0]?.couriers?.asaas_wallet_id
    const commissionRate = Number(order.stores?.commission_rate ?? 4)
    const ownDelivery = Boolean(order.own_delivery)
    const deliveryFeeCents = toCents(Number(order.delivery_fee) || 0)
    const subtotalCents = toCents(Number(order.subtotal) || (Number(order.total) - Number(order.delivery_fee || 0)))
    const totalCents = toCents(Number(order.total))

    if (!storeWalletId) {
      throw new Error('A loja ainda não possui carteira Asaas. Gere a conta Asaas antes de cobrar o pedido.')
    }

    if (commissionRate < 0 || commissionRate > 100) {
      throw new Error(`Taxa de comissão inválida para a loja: ${commissionRate}`)
    }

    if (!ownDelivery && deliveryFeeCents > 0 && !courierWalletId) {
      throw new Error('A taxa de entrega existe, mas nenhum motoboy com carteira Asaas foi vinculado ao pedido.')
    }

    // Taxa cobrada pelo Asaas por transação (sai do repasse da loja, não da plataforma)
    // PIX: R$ 1,99 fixo | Cartão de crédito: 2,99% do total | Dinheiro: sem taxa
    const asaasFee = method === 'PIX'
      ? 1.99
      : method === 'CREDIT_CARD'
        ? parseFloat((Number(order.total) * 0.0299).toFixed(2))
        : 0
    const asaasFeeCents = toCents(asaasFee)

    // Cálculo do split com validação em centavos
    const platformAmountCents = Math.round((subtotalCents * commissionRate) / 100)
    let storeAmountCents = subtotalCents - platformAmountCents - asaasFeeCents
    let courierAmountCents = 0

    if (ownDelivery) {
      storeAmountCents += deliveryFeeCents
    } else {
      courierAmountCents = deliveryFeeCents
    }

    if (storeAmountCents < 0) {
      throw new Error('Repasse da loja ficou negativo após descontar comissão e taxa do Asaas. Revise a configuração.')
    }

    const splitCents = storeAmountCents + courierAmountCents
    const expectedPlatformAndFeeCents = totalCents - splitCents
    const configuredPlatformAndFeeCents = platformAmountCents + asaasFeeCents

    if (expectedPlatformAndFeeCents !== configuredPlatformAndFeeCents) {
      throw new Error(
        `Divergência no split do pedido ${orderId}: esperado plataforma+taxa=${fromCents(expectedPlatformAndFeeCents)}, calculado=${fromCents(configuredPlatformAndFeeCents)}`
      )
    }

    const platformAmount = fromCents(platformAmountCents)
    const storeAmount = fromCents(storeAmountCents)
    const courierAmount = fromCents(courierAmountCents)

    // Splits para subcontas
    const splits: any[] = []
    if (storeAmount > 0) {
      splits.push({ walletId: storeWalletId, fixedValue: storeAmount })
    }
    if (courierWalletId && courierAmount > 0) {
      splits.push({ walletId: courierWalletId, fixedValue: courierAmount })
    }

    // PIX expira em 30 minutos
    const dueDate = new Date()
    dueDate.setMinutes(dueDate.getMinutes() + 30)

    const paymentPayload: any = {
      customer: customerId,
      billingType: method,
      value: Number(order.total),
      dueDate: dueDate.toISOString().split('T')[0],
      description: `Pedido #${orderId} - ${order.stores?.name}`,
      externalReference: String(orderId),
      split: splits.length > 0 ? splits : undefined,
      // Taxa do Asaas descontada do repasse da loja (asaasFee já subtraído do storeAmount)
      fine: { value: 0 },
      interest: { value: 0 },
      postalService: false,
    }

    if (method === 'CREDIT_CARD') {
      if (cardData) {
        // Cartão novo — dados completos enviados pelo frontend
        paymentPayload.creditCard = {
          holderName: cardData.holderName,
          number: cardData.number,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          ccv: cardData.ccv,
        }
        paymentPayload.creditCardHolderInfo = {
          name: cardData.holderName,
          email: order.users?.email || '',
          cpfCnpj: (order.users?.cpf || '').replace(/\D/g, ''),
          postalCode: '00000000',
          addressNumber: '0',
          phone: (order.users?.phone || '').replace(/\D/g, ''),
        }
      } else if (savedCardData) {
        // Cartão salvo — reconta com dados parciais + CVV
        paymentPayload.creditCard = {
          holderName: savedCardData.holderName,
          number: savedCardData.number,
          expiryMonth: savedCardData.expiryMonth,
          expiryYear: savedCardData.expiryYear,
          ccv: savedCardData.ccv,
        }
        paymentPayload.creditCardHolderInfo = {
          name: savedCardData.holderName,
          email: order.users?.email || '',
          cpfCnpj: (order.users?.cpf || '').replace(/\D/g, ''),
          postalCode: '00000000',
          addressNumber: '0',
          phone: (order.users?.phone || '').replace(/\D/g, ''),
        }
      }
    }

    const asaasRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload)
    })

    const asaasPayment = await asaasRes.json()
    if (!asaasRes.ok) throw new Error(`Asaas error: ${JSON.stringify(asaasPayment)}`)

    // Busca QR code PIX
    let pixQrCode = null
    let pixCopyPaste = null
    if (method === 'PIX') {
      const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPayment.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
      })
      const qrData = await qrRes.json()
      pixQrCode = qrData.encodedImage
      pixCopyPaste = qrData.payload
    }

    // Salva pagamento no banco
    await supabase.from('payments').insert({
      order_id: orderId,
      asaas_payment_id: asaasPayment.id,
      method: method.toLowerCase(),
      status: 'pending',
      amount: Number(order.total),
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
      pix_expiration: method === 'PIX' ? dueDate.toISOString() : null,
      split_store_amount: storeAmount,
      split_platform_amount: platformAmount,
      split_courier_amount: courierAmount,
      asaas_fee: asaasFee,
    })

    await supabase.from('orders').update({ payment_status: 'pending' }).eq('id', orderId)

    return new Response(JSON.stringify({
      success: true,
      paymentId: asaasPayment.id,
      pixQrCode,
      pixCopyPaste,
      pixExpiration: method === 'PIX' ? dueDate.toISOString() : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('create-payment error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
