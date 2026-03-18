/*
# Enable RLS on core tables
Enables Row Level Security on tables that had it disabled to resolve security advisories.

## Query Description:
This operation enables Row Level Security (RLS) on several core tables (addresses, couriers, deliveries, order_items, orders, products, stores, users) to ensure data privacy and security. The tables already have the necessary policies defined, so this simply activates the enforcement of those policies.

## Metadata:
- Schema-Category: "Security"
- Impact-Level: "High"
- Requires-Backup: false
- Reversible: true

## Structure Details:
Enables RLS on: addresses, couriers, deliveries, order_items, orders, products, stores, users.

## Security Implications:
- RLS Status: Enabled for all core tables
- Policy Changes: None (existing policies will now be enforced)
- Auth Requirements: Standard auth requirements apply

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Low
*/

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
