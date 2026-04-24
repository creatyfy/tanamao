CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
      INSERT INTO public.users (id, name, email, role, is_active, password_hash, cpf)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        v_role,
        CASE WHEN v_role = 'client' THEN true ELSE false END,
        'supabase_auth',
        NEW.raw_user_meta_data->>'cpf'
      );
    ELSE
      UPDATE public.users
      SET cpf = COALESCE(cpf, NEW.raw_user_meta_data->>'cpf')
      WHERE id = NEW.id AND cpf IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
