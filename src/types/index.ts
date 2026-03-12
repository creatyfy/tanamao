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

export interface Order {
  id: number;
  client_id: string;
  store_id: number;
  courier_id: number | null;
  status: string;
  total: number;
  created_at: string;
}

export interface Delivery {
  id: number;
  order_id: number;
  courier_id: number;
  status: string;
  courier_earning: number;
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
