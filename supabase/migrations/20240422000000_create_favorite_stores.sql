/*
# Create Favorite Stores Table
Adiciona uma tabela para permitir que os clientes favoritem lojas.

## Query Description:
Esta operação cria uma nova tabela `favorite_stores` para armazenar a relação entre clientes e suas lojas favoritas. Também habilita o Row Level Security (RLS) para que os usuários só possam ver e gerenciar seus próprios favoritos.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Cria a tabela `favorite_stores` com `user_id` e `store_id`
- Adiciona chaves estrangeiras para `users` e `stores`
- Adiciona restrição única (UNIQUE) em `(user_id, store_id)` para evitar favoritos duplicados
- Habilita RLS e cria políticas de Select, Insert e Delete
*/

CREATE TABLE IF NOT EXISTS public.favorite_stores (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, store_id)
);

-- Habilitar RLS
ALTER TABLE public.favorite_stores ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS)
CREATE POLICY "Users can view their own favorites"
    ON public.favorite_stores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
    ON public.favorite_stores FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
    ON public.favorite_stores FOR DELETE
    USING (auth.uid() = user_id);
