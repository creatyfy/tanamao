import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const currentHour = now.getUTCHours() - 3 // Ajuste para horário de Brasília (UTC-3)
    const currentDay = now.getDay() // 0=domingo ... 6=sábado

    // 1. Busca notificações agendadas que já passaram do horário
    const { data: scheduledNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())

    // 2. Busca notificações repetidas (daily/weekly) que precisam ser disparadas hoje
    const { data: repeatingNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('status', 'sent')
      .not('repeat_type', 'is', null)

    const toProcess = []

    // Adiciona notificações agendadas
    if (scheduledNotifs) toProcess.push(...scheduledNotifs)

    // Verifica notificações repetidas
    if (repeatingNotifs) {
      for (const notif of repeatingNotifs) {
        const shouldFire =
          // Diário: verifica se já foi enviada hoje
          (notif.repeat_type === 'daily' && notif.repeat_hour === currentHour &&
            (!notif.sent_at || new Date(notif.sent_at).toDateString() !== now.toDateString())) ||
          // Semanal: verifica dia da semana e hora
          (notif.repeat_type === 'weekly' && notif.repeat_day === currentDay &&
            notif.repeat_hour === currentHour &&
            (!notif.sent_at || new Date(notif.sent_at).toDateString() !== now.toDateString()))

        if (shouldFire) toProcess.push(notif)
      }
    }

    if (toProcess.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), { status: 200 })
    }

    // Processa cada notificação
    let processed = 0
    for (const notif of toProcess) {
      try {
        // Chama a send-push existente
        const res = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              notificationId: notif.id,
              title: notif.title,
              body: notif.body,
              targetType: notif.target_type,
              targetCity: notif.target_city,
            })
          }
        )

        if (res.ok) {
          // Atualiza status
          const newStatus = notif.repeat_type ? 'sent' : 'sent'
          await supabase.from('notifications').update({
            status: newStatus,
            sent_at: now.toISOString(),
            sent_count: (notif.sent_count || 0) + 1,
          }).eq('id', notif.id)

          processed++
        }
      } catch (err) {
        console.error(`Failed to process notification ${notif.id}:`, err)
        await supabase.from('notifications').update({
          status: 'failed',
        }).eq('id', notif.id)
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, total: toProcess.length }),
      { status: 200 }
    )

  } catch (error: any) {
    console.error('process-scheduled-notifications error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
