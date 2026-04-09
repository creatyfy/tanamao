/*
  # Cron Job para Notificações Agendadas
  Configura o pg_cron para rodar a Edge Function de notificações a cada hora.
*/

-- Habilita a extensão pg_cron (já disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job antigo se existir
SELECT cron.unschedule('process-scheduled-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-notifications'
);

-- Cria job que roda a cada hora no minuto 0
SELECT cron.schedule(
  'process-scheduled-notifications',
  '0 * * * *', -- todo hora em ponto
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
