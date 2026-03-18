export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'store_owner' | 'courier' | 'admin';
  is_active: boolean;
}

export interface StoreCategory {
  id: number;
  name: string;
  icon: string;
}

export interface Store {
  id: number;
  owner_id: string;
  name: string;
  logo_url: string;
  banner_url: string;
  avg_rating: number;
  avg_prep_time_min: number;
  delivery_fee: number;
  global_category_id: number;
  is_open: boolean;
  is_approved: boolean;
  status: string;
  commission_rate: number;
  addresses?: any;
}

export interface Product {
  id: number;
  store_id: number;
  name: string;
  description: string;
  image_url: string;
  price: number;
  is_available: boolean;
  category_id: number;
}

export interface Coupon {
  id: number;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  min_order_value: number;
  max_uses: number | null;
  max_uses_per_user: number;
  store_id: number;
  created_by: string;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: number;
  client_id: string;
  store_id: number;
  courier_id: number | null;
  status: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  change_for: number | null;
  coupon_id?: number | null;
  client_notes?: string | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  delivery_code?: string;
  own_delivery?: boolean;
  created_at: string;
  order_items?: any[];
}

export interface Delivery {
  id: number;
  order_id: number;
  courier_id: number | null;
  status: string;
  courier_earning: number;
  accepted_at?: string;
  delivered_at?: string;
}

export interface Courier {
  id: number;
  user_id: string;
  is_online: boolean;
  is_approved: boolean;
  status: string;
  available_balance: number;
  total_deliveries: number;
}

export interface Review {
  id: number;
  reviewer_id: string;
  target_type: string;
  target_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}
