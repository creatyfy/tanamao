/*
  # Enable Row Level Security (RLS) and Create Policies
  
  ## Query Description:
  This operation enables RLS on all public tables to secure the database and resolve security advisories. It creates policies tailored to the application's roles (client, store_owner, courier, admin) ensuring users can only access and modify data they are authorized to. It also adds a trigger to automatically update store ratings.
  
  ## Metadata:
  - Schema-Category: Security
  - Impact-Level: High
  - Requires-Backup: false
  - Reversible: true
  
  ## Security Implications:
  - RLS Status: Enabled on all tables
  - Policy Changes: Yes, comprehensive policies added
  - Auth Requirements: Requires authenticated users for most operations
*/

-- 1. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 2. Create Admin Check Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create Policies

-- Users
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Enable update for users based on id" ON public.users FOR UPDATE USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Enable delete for admins" ON public.users FOR DELETE USING (public.is_admin());

-- Addresses
CREATE POLICY "Enable read access for all users" ON public.addresses FOR SELECT USING (true);
CREATE POLICY "Enable all access for users based on user_id" ON public.addresses FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Store Categories
CREATE POLICY "Enable read access for all users" ON public.store_categories FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.store_categories FOR ALL USING (public.is_admin());

-- Stores
CREATE POLICY "Enable read access for all users" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.stores FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Enable update for owners and admins" ON public.stores FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "Enable delete for admins" ON public.stores FOR DELETE USING (public.is_admin());

-- Product Categories
CREATE POLICY "Enable read access for all users" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Enable all access for store owners" ON public.product_categories FOR ALL USING (
  auth.uid() IN (SELECT owner_id FROM public.stores WHERE id = store_id) OR public.is_admin()
);

-- Products
CREATE POLICY "Enable read access for all users" ON public.products FOR SELECT USING (true);
CREATE POLICY "Enable all access for store owners" ON public.products FOR ALL USING (
  auth.uid() IN (SELECT owner_id FROM public.stores WHERE id = store_id) OR public.is_admin()
);

-- Couriers
CREATE POLICY "Enable read access for all users" ON public.couriers FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.couriers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for couriers and admins" ON public.couriers FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Enable delete for admins" ON public.couriers FOR DELETE USING (public.is_admin());

-- Coupons
CREATE POLICY "Enable read access for all users" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Enable all access for store owners" ON public.coupons FOR ALL USING (
  auth.uid() IN (SELECT owner_id FROM public.stores WHERE id = store_id) OR public.is_admin()
);

-- Orders
CREATE POLICY "Enable read access for involved parties" ON public.orders FOR SELECT USING (
  auth.uid() = client_id OR 
  auth.uid() IN (SELECT owner_id FROM public.stores WHERE id = store_id) OR 
  auth.uid() IN (SELECT user_id FROM public.couriers WHERE id = courier_id) OR 
  public.is_admin()
);
CREATE POLICY "Enable insert for clients" ON public.orders FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Enable update for involved parties" ON public.orders FOR UPDATE USING (
  auth.uid() = client_id OR 
  auth.uid() IN (SELECT owner_id FROM public.stores WHERE id = store_id) OR 
  auth.uid() IN (SELECT user_id FROM public.couriers WHERE id = courier_id) OR 
  (courier_id IS NULL AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'courier')) OR
  public.is_admin()
);

-- Order Items
CREATE POLICY "Enable read access for all users" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated users" ON public.order_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Coupon Usages
CREATE POLICY "Enable read access for all users" ON public.coupon_usages FOR SELECT USING (true);
CREATE POLICY "Enable insert for clients" ON public.coupon_usages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Deliveries
CREATE POLICY "Enable read access for all users" ON public.deliveries FOR SELECT USING (true);
CREATE POLICY "Enable insert for store owners" ON public.deliveries FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM public.stores JOIN public.orders ON orders.store_id = stores.id WHERE orders.id = order_id) OR public.is_admin()
);
CREATE POLICY "Enable update for couriers and store owners" ON public.deliveries FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM public.couriers WHERE id = courier_id) OR 
  (status = 'offered' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'courier')) OR
  auth.uid() IN (SELECT owner_id FROM public.stores JOIN public.orders ON orders.store_id = stores.id WHERE orders.id = order_id) OR 
  public.is_admin()
);

-- Order Chats
CREATE POLICY "Enable read access for all users" ON public.order_chats FOR SELECT USING (true);
CREATE POLICY "Enable insert for senders" ON public.order_chats FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Reviews
CREATE POLICY "Enable read access for all users" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Enable insert for clients" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Enable delete for admins" ON public.reviews FOR DELETE USING (public.is_admin());

-- 4. Create Trigger for Store Ratings
CREATE OR REPLACE FUNCTION public.update_store_avg_rating()
RETURNS trigger AS $$
BEGIN
  IF NEW.target_type = 'store' THEN
    UPDATE public.stores
    SET avg_rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
      FROM public.reviews
      WHERE target_type = 'store' AND target_id = NEW.target_id
    )
    WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_store_rating_trigger ON public.reviews;
CREATE TRIGGER update_store_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_store_avg_rating();
