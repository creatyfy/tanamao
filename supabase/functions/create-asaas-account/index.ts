import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { entityType, entityId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca dados da entidade
    let name: string, email: string, phone: string, cpfCnpj: string,
        pixKey: string | null, street: string, number: string,
        neighborhood: string, zipCode: string, state: string

    if (entityType === 'store') {
      const { data } = await supabase
        .from('stores')
        .select('*, users:owner_id(name, email, phone), addresses(*)')
        .eq('id', entityId)
        .single()
      if (!data) throw new Error('Loja não encontrada')
      name = data.name
      email = data.users?.email
      phone = (data.users?.phone || '').replace(/\D/g, '')
      cpfCnpj = (data.cnpj || '').replace(/\D/g, '')
      pixKey = data.pix_key?.trim() || null
      street = data.addresses?.street || 'Não informado'
      number = data.addresses?.number || 'S/N'
      neighborhood = data.addresses?.neighborhood || 'Não informado'
      zipCode = (data.addresses?.zip_code || '00000000').replace(/\D/g, '')
      state = data.addresses?.state || 'SP'
    } else {
      const { data } = await supabase
        .from('couriers')
        .select('*, users:user_id(name, email, phone), addresses(*)')
        .eq('id', entityId)
        .single()
      if (!data) throw new Error('Motoboy não encontrado')
      name = data.users?.name
      email = data.users?.email
      phone = (data.users?.phone || '').replace(/\D/g, '')
      cpfCnpj = (data.cpf || '').replace(/\D/g, '')
      pixKey = data.pix_key?.trim() || null
      street = data.addresses?.street || 'Não informado'
      number = data.addresses?.number || 'S/N'
      neighborhood = data.addresses?.neighborhood || 'Não informado'
      zipCode = (data.addresses?.zip_code || '00000000').replace(/\D/g, '')
      state = data.addresses?.state || 'SP'
    }

    if (cpfCnpj.length < 11) {
      throw new Error('CPF/CNPJ inválido ou ausente para criar conta Asaas')
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL')!

    // 1. Cria subconta Asaas Connect
    const accountPayload = {
      name,
      email,
      mobilePhone: phone,
      cpfCnpj,
      companyType: entityType === 'store' && cpfCnpj.length === 14 ? 'MEI' : undefined,
      address: street,
      addressNumber: number,
      province: neighborhood,
      postalCode: zipCode,
    }

    console.log('Asaas account payload:', accountPayload)

    const accountRes = await fetch(`${ASAAS_BASE_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(accountPayload)
    })

    const accountBodyText = await accountRes.text()
    let account: any = null
    try {
      account = accountBodyText ? JSON.parse(accountBodyText) : null
    } catch {
      account = { raw: accountBodyText }
    }

    if (!accountRes.ok) {
      console.error('Asaas error', accountRes.status, JSON.stringify(account))
      console.error('Asaas account creation failed', {
        status: accountRes.status,
        statusText: accountRes.statusText,
        payload: accountPayload,
        response: account,
      })
      throw new Error(`Erro ao criar conta no Asaas (HTTP ${accountRes.status}): ${JSON.stringify(account)}`)
    }

    const walletId = account.walletId
    const accountId = account.id

    // 2. Configura saque automático toda segunda-feira para a chave PIX
    if (pixKey) {
      const transferConfig = {
        bankAccountType: 'PIX',
        pixAddressKey: pixKey,
        scheduleOffset: 1, // 1 = toda segunda-feira
        enabled: true,
      }

      await fetch(`${ASAAS_BASE_URL}/accounts/${accountId}/transferSettings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: JSON.stringify(transferConfig)
      })
    } else {
      console.log('Asaas transferSettings skipped: pixKey ausente')
    }

    // 3. Salva no banco
    const updateData = { asaas_account_id: accountId, asaas_wallet_id: walletId }
    if (entityType === 'store') {
      await supabase.from('stores').update(updateData).eq('id', entityId)
    } else {
      await supabase.from('couriers').update(updateData).eq('id', entityId)
    }

    return new Response(JSON.stringify({ success: true, walletId, accountId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('create-asaas-account error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
