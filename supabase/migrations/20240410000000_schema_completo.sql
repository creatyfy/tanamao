/*
  # Schema Completo do Banco de Dados
  Criação de todas as tabelas, relacionamentos e configurações iniciais do sistema.

  ## Query Description:
  Esta operação cria a estrutura completa do banco de dados para o aplicativo de delivery, incluindo tabelas para usuários, lojas, produtos, pedidos, entregadores e avaliações. Também insere dados iniciais de categorias e configura os buckets de storage.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "High"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Tables: users, addresses, store_categories, stores, product_categories, products, couriers, coupons, orders, order_items, coupon_usages, deliveries, order_chats, reviews
  - Storage Buckets: avatars, products, stores
*/

SET statement_timeout = 0;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('client', 'store_owner', 'courier', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.addresses (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT,
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.store_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.stores (
    id SERIAL PRIMARY KEY,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    cnpj TEXT,
    phone TEXT,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    avg_rating NUMERIC(3,1) DEFAULT 0.0,
    avg_prep_time_min INTEGER DEFAULT 30,
    min_order_value NUMERIC(10,2) DEFAULT 0.00,
    delivery_fee NUMERIC(10,2) DEFAULT 0.00,
    global_category_id INTEGER REFERENCES public.store_categories(id),
    is_open BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending',
    commission_rate NUMERIC(5,2) DEFAULT 4.00,
    address_id INTEGER REFERENCES public.addresses(id),
    accepts_pix BOOLEAN DEFAULT true,
    accepts_card BOOLEAN DEFAULT true,
    accepts_cash BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.product_categories (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.products (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES public.stores(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES public.product_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.couriers (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    cpf TEXT UNIQUE NOT NULL,
    vehicle_type TEXT NOT NULL,
    vehicle_brand TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    license_plate TEXT,
    pix_key TEXT,
    operation_city TEXT NOT NULL,
    is_online BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending',
    last_lat DOUBLE PRECISION,
    last_lng DOUBLE PRECISION,
    location_at TIMESTAMP WITH TIME ZONE,
    available_balance NUMERIC(10,2) DEFAULT 0.00,
    total_deliveries INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.coupons (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fixed', 'percentage')),
    value NUMERIC(10,2) NOT NULL,
    min_order_value NUMERIC(10,2) DEFAULT 0.00,
    max_uses INTEGER,
    max_uses_per_user INTEGER DEFAULT 1,
    store_id INTEGER REFERENCES public.stores(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id),
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(code, store_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
    id SERIAL PRIMARY KEY,
    client_id UUID REFERENCES public.users(id),
    store_id INTEGER REFERENCES public.stores(id),
    courier_id INTEGER REFERENCES public.couriers(id),
    delivery_address_id INTEGER REFERENCES public.addresses(id),
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    change_for NUMERIC(10,2),
    coupon_id INTEGER REFERENCES public.coupons(id),
    client_notes TEXT,
    cancel_reason TEXT,
    cancelled_by TEXT,
    delivery_code TEXT,
    own_delivery BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    courier_id INTEGER REFERENCES public.couriers(id),
    status TEXT NOT NULL DEFAULT 'offered',
    courier_earning NUMERIC(10,2) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    pickup_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.order_chats (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('store', 'courier', 'client')),
    target_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Desativa RLS para desenvolvimento (pode ser reativado depois)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;

-- Categorias de lojas (dados iniciais)
INSERT INTO public.store_categories (id, name, icon, sort_order)
VALUES
    (1, 'Lanches', '🍔', 1),
    (2, 'Pizza', '🍕', 2),
    (3, 'Japonesa', '🍣', 3),
    (4, 'Brasileira', '🍲', 4),
    (5, 'Doces', '🍩', 5),
    (6, 'Bebidas', '🥤', 6),
    (7, 'Saudável', '🥗', 7),
    (8, 'Açaí', '🫐', 8),
    (9, 'Mercado', '🛒', 9),
    (10, 'Farmácia', '💊', 10)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon;

-- Storage buckets para imagens
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('stores', 'stores', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id IN ('avatars', 'products', 'stores'));

-- Realtime para pedidos, entregas e chat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['stores', 'orders', 'deliveries', 'order_chats', 'couriers'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
    END;
  END LOOP;
END $$;
