import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AddressLike = {
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  zip_code?: string | null
  city?: string | null
  state?: string | null
}

const normalizeAddress = (address: AddressLike | AddressLike[] | null | undefined): Required<AddressLike> => {
  const source = Array.isArray(address) ? (address[0] ?? {}) : (address ?? {})

  return {
    street: source.street?.trim() || '',
    number: source.number?.trim() || 'S/N',
    neighborhood: source.neighborhood?.trim() || '',
    zip_code: (source.zip_code || '').replace(/\D/g, ''),
    city: source.city?.trim() || '',
    state: source.state?.trim() || '',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const requestId = crypto.randomUUID()

  try {
    const body = await req.json()
    const { entityType, entityId } = body ?? {}

    console.log(`[${requestId}] create-asaas-account called`, { entityType, entityId })

    if (!entityType || !entityId || !['store', 'courier'].includes(entityType)) {
      throw new Error('Parâmetros inválidos. Esperado: entityType (store|courier) e entityId.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY')
    const asaasBaseUrl = Deno.env.get('ASAAS_BASE_URL')

    if (!supabaseUrl || !supabaseServiceRole || !asaasApiKey || !asaasBaseUrl) {
      throw new Error('Configuração ausente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ASAAS_API_KEY ou ASAAS_BASE_URL')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole)

    // Busca dados da entidade
    let name: string
    let email: string
    let phone: string
    let cpfCnpj: string
    let pixKey: string | null
    let street: string
    let number: string
    let neighborhood: string
    let zipCode: string
    let city: string
    let state: string

    if (entityType === 'store') {
      const { data, error } = await supabase
        .from('stores')
        .select('*, users:owner_id(name, email, phone), addresses(*)')
        .eq('id', entityId)
        .single()

      if (error) throw new Error(`Erro ao buscar loja: ${error.message}`)
      if (!data) throw new Error('Loja não encontrada')

      const address = normalizeAddress(data.addresses)
      name = data.name?.trim()
      email = data.users?.email?.trim()
      phone = (data.users?.phone || '').replace(/\D/g, '')
      cpfCnpj = (data.cnpj || '').replace(/\D/g, '')
      pixKey = data.pix_key?.trim() || null
      street = address.street
      number = address.number
      neighborhood = address.neighborhood
      zipCode = address.zip_code
      city = address.city
      state = address.state
    } else {
      const { data, error } = await supabase
        .from('couriers')
        .select('*, users:user_id(name, email, phone), addresses(*)')
        .eq('id', entityId)
        .single()

      if (error) throw new Error(`Erro ao buscar motoboy: ${error.message}`)
      if (!data) throw new Error('Motoboy não encontrado')

      const address = normalizeAddress(data.addresses)
      name = data.users?.name?.trim()
      email = data.users?.email?.trim()
      phone = (data.users?.phone || '').replace(/\D/g, '')
      cpfCnpj = (data.cpf || '').replace(/\D/g, '')
      pixKey = data.pix_key?.trim() || null
      street = address.street
      number = address.number
      neighborhood = address.neighborhood
      zipCode = address.zip_code
      city = address.city
      state = address.state
    }

    if (!name || !email) throw new Error('Nome e e-mail são obrigatórios para criar conta Asaas')
    if (phone.length < 10) throw new Error('Telefone inválido ou ausente para criar conta Asaas')
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      throw new Error('CPF/CNPJ inválido ou ausente para criar conta Asaas')
    }
    if (!street || !neighborhood || !zipCode || !city || !state) {
      throw new Error('Endereço incompleto. Preencha rua, bairro, CEP, cidade e estado.')
    }

    // 1. Cria subconta Asaas Connect
    const accountPayload = {
      name,
      email,
      mobilePhone: phone,
      cpfCnpj,
      ...(cpfCnpj.length === 14 ? { companyType: 'MEI' } : {}),
      address: street,
      addressNumber: number,
      province: neighborhood,
      postalCode: zipCode,
      city,
      state,
    }

    console.log(`[${requestId}] Asaas account payload`, accountPayload)

    const accountRes = await fetch(`${asaasBaseUrl}/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify(accountPayload),
    })

    const accountBodyText = await accountRes.text()
    let account: any = null
    try {
      account = accountBodyText ? JSON.parse(accountBodyText) : null
    } catch {
      account = { raw: accountBodyText }
    }

    if (!accountRes.ok) {
      console.error(`[${requestId}] Asaas account creation failed`, {
        status: accountRes.status,
        statusText: accountRes.statusText,
        response: account,
      })
      throw new Error(`Erro ao criar conta no Asaas (HTTP ${accountRes.status}): ${JSON.stringify(account)}`)
    }

    const walletId = account.walletId
    const accountId = account.id

    if (!accountId || !walletId) {
      throw new Error(`Resposta inesperada do Asaas ao criar conta: ${JSON.stringify(account)}`)
    }

    // 2. Configura saque automático para PIX
    if (pixKey) {
      const transferConfig = {
        bankAccountType: 'PIX',
        pixAddressKey: pixKey,
        scheduleOffset: 1,
        enabled: true,
      }

      const transferRes = await fetch(`${asaasBaseUrl}/accounts/${accountId}/transferSettings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify(transferConfig),
      })

      if (!transferRes.ok) {
        const transferBody = await transferRes.text()
        console.error(`[${requestId}] Asaas transferSettings failed`, {
          status: transferRes.status,
          response: transferBody,
        })
      }
    } else {
      console.log(`[${requestId}] Asaas transferSettings skipped: pixKey ausente`)
    }

    // 3. Salva no banco
    const updateData = { asaas_account_id: accountId, asaas_wallet_id: walletId }
    if (entityType === 'store') {
      const { error } = await supabase.from('stores').update(updateData).eq('id', entityId)
      if (error) throw new Error(`Erro ao salvar Asaas na loja: ${error.message}`)
    } else {
      const { error } = await supabase.from('couriers').update(updateData).eq('id', entityId)
      if (error) throw new Error(`Erro ao salvar Asaas no motoboy: ${error.message}`)
    }

    return new Response(JSON.stringify({ success: true, walletId, accountId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error(`[${requestId}] create-asaas-account error:`, error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
