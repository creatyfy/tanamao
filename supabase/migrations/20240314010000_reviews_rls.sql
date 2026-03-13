-- supabase/migrations/20240314010000_reviews_rls.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'clientes_criam_reviews'
    AND tablename = 'reviews'
  ) THEN
    CREATE POLICY "clientes_criam_reviews" ON reviews
      FOR INSERT WITH CHECK (reviewer_id = auth.uid());
  END IF;
END $$;
