/*
# Correção de Segurança: Search Path

## Query Description: 
Esta operação define explicitamente o search_path para a função auto_confirm_email_fn, resolvendo o aviso de segurança do Supabase.

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true
*/

ALTER FUNCTION public.auto_confirm_email_fn() SET search_path = public;
