import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Store, StoreCategory, Product, Order } from '../types';
import { Search, MapPin, Star, Clock, Bike, ChevronLeft, Plus, Minus, ShoppingBag, CheckCircle, History, Home, User, CreditCard, Loader2 } from 'lucide-react';

export default function ClientApp({ onExit }: { onExit: () => void }) {
  const { user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('home');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  
  // Tracking
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      const [catRes, storeRes] = await Promise.all([
        supabase.from('store_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('stores').select('*').eq('is_approved', true).eq('status', 'active')
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (storeRes.data) setStores(storeRes.data);
    } catch (error) {
      console.error('Erro ao carregar home:', error);
    } finally {
      setLoading(false);
    }
  };

  const openStore = async (store: Store) => {
    setSelectedStore(store);
    setLoading(true);
    setCurrentScreen('store');
    try {
      const { data } = await supabase.from('products').select('*').eq('store_id', store.id).eq('is_available', true);
      if (data) setProducts(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = selectedStore?.delivery_fee || 0;

  const handleCheckout = async () => {
    if (!user || !selectedStore) return;
    setLoading(true);
    try {
      // 1. Get Address (mocking first address for simplicity)
      const { data: addresses } = await supabase.from('addresses').select('id').eq('user_id', user.id).limit(1);
      const addressId = addresses?.[0]?.id;
      if (!addressId) throw new Error("Endereço não encontrado. Cadastre um endereço no perfil.");

      // 2. Create Order
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        client_id: user.id,
        store_id: selectedStore.id,
        delivery_address_id: addressId,
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        total: cartTotal + deliveryFee,
        payment_method: 'pix',
        status: 'pending'
      }).select().single();
      if (orderError) throw orderError;

      // 3. Create Items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));
      await supabase.from('order_items').insert(orderItems);

      // 4. Create Payment
      await supabase.from('payments').insert({
        order_id: order.id,
        gateway: 'mock',
        amount: cartTotal + deliveryFee,
        method: 'pix',
        status: 'pending'
      });

      setCart([]);
      setActiveOrder(order);
      setCurrentScreen('tracking');
      subscribeToOrder(order.id);
    } catch (error: any) {
      alert(error.message || 'Erro ao finalizar pedido.');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrder = (orderId: number) => {
    supabase.channel(`order_${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, payload => {
        setActiveOrder(payload.new as Order);
      }).subscribe();
  };

  const getStatusText = (status: string) => {
    const map: any = {
      pending: "Aguardando confirmação", accepted: "Confirmado!", preparing: "Em preparo 👨‍🍳",
      ready: "Pronto! Aguardando motoboy 📦", delivering: "Saiu para entrega! 🏍️", delivered: "Entregue! 🎉", cancelled: "Cancelado"
    };
    return map[status] || status;
  };

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-gray-50 flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-8 border-4 border-gray-900">
      {loading && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={40}/></div>}
      
      {currentScreen === 'home' && (
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="bg-white p-4 rounded-b-3xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center text-brand-dark">
                <MapPin size={20} className="text-brand-primary mr-1" />
                <span className="font-semibold text-sm">Meu Endereço</span>
              </div>
              <button onClick={onExit} className="text-xs text-gray-500 underline">Sair</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input type="text" placeholder="O que vamos pedir hoje?" className="w-full bg-gray-100 rounded-full py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm" />
            </div>
          </div>

          <div className="p-4">
            <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide mb-6">
              {categories.map(cat => (
                <div key={cat.id} className="flex flex-col items-center min-w-[70px]">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-2xl mb-2">{cat.icon || '🍔'}</div>
                  <span className="text-xs font-medium text-brand-dark">{cat.name}</span>
                </div>
              ))}
            </div>

            <h2 className="font-bold text-brand-dark text-lg mb-4">Lojas Disponíveis</h2>
            <div className="space-y-4">
              {stores.map(store => (
                <div key={store.id} onClick={() => openStore(store)} className="bg-white p-3 rounded-2xl shadow-sm flex items-center cursor-pointer active:scale-95 transition-transform">
                  <img src={store.logo_url || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=200&fit=crop'} alt={store.name} className="w-16 h-16 rounded-xl object-cover" />
                  <div className="ml-3 flex-1">
                    <h3 className="font-bold text-brand-dark">{store.name}</h3>
                    <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                      <span className="flex items-center text-brand-secondary font-bold"><Star size={12} className="mr-1 fill-current" /> {store.avg_rating}</span>
                      <span>•</span><span>{store.avg_prep_time_min} min</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {store.delivery_fee === 0 ? <span className="text-brand-primary font-semibold">Entrega Grátis</span> : `Taxa R$ ${store.delivery_fee.toFixed(2)}`}
                    </div>
                  </div>
                </div>
              ))}
              {stores.length === 0 && !loading && <p className="text-center text-gray-500 text-sm">Nenhuma loja disponível no momento.</p>}
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'store' && selectedStore && (
        <div className="flex-1 overflow-y-auto bg-white pb-24">
          <div className="relative h-40 bg-gray-200">
            <img src={selectedStore.banner_url || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=400&fit=crop'} className="w-full h-full object-cover" alt="Banner" />
            <button onClick={() => setCurrentScreen('home')} className="absolute top-4 left-4 bg-white p-2 rounded-full shadow-md text-brand-dark"><ChevronLeft size={20} /></button>
          </div>
          <div className="px-4 pb-4 pt-2 relative">
            <div className="bg-white rounded-2xl shadow-md p-4 -mt-8 relative z-10 border border-gray-100">
              <h1 className="text-2xl font-bold text-brand-dark">{selectedStore.name}</h1>
              <div className="flex items-center text-sm text-gray-600 mt-2 space-x-4">
                <span className="flex items-center text-brand-secondary font-bold"><Star size={16} className="mr-1 fill-current" /> {selectedStore.avg_rating}</span>
                <span className="flex items-center"><Clock size={16} className="mr-1" /> {selectedStore.avg_prep_time_min} min</span>
                <span className="flex items-center"><Bike size={16} className="mr-1" /> R$ {selectedStore.delivery_fee.toFixed(2)}</span>
              </div>
            </div>

            <h2 className="font-bold text-brand-dark text-lg mt-6 mb-4">Cardápio</h2>
            <div className="space-y-4">
              {products.map(product => (
                <div key={product.id} className="flex border-b border-gray-100 pb-4">
                  <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-brand-dark">{product.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                    <div className="mt-2 font-bold text-brand-dark">R$ {product.price.toFixed(2)}</div>
                  </div>
                  <div className="relative">
                    <img src={product.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop'} className="w-24 h-24 rounded-xl object-cover" alt={product.name} />
                    <button onClick={() => addToCart(product)} className="absolute -bottom-2 -right-2 bg-brand-primary text-white p-2 rounded-full shadow-md hover:bg-green-600"><Plus size={16} /></button>
                  </div>
                </div>
              ))}
              {products.length === 0 && !loading && <p className="text-center text-gray-500 text-sm">Nenhum produto cadastrado.</p>}
            </div>
          </div>
          
          {cart.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-20">
              <button onClick={() => setCurrentScreen('cart')} className="w-full bg-brand-primary text-white rounded-full py-4 px-6 flex justify-between items-center shadow-lg font-bold">
                <div className="flex items-center"><span className="bg-white text-brand-primary rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span> Ver carrinho</div>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {currentScreen === 'cart' && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-6 flex items-center border-b border-gray-100">
            <button onClick={() => setCurrentScreen('store')} className="text-brand-dark mr-4"><ChevronLeft size={24} strokeWidth={2.5} /></button>
            <h1 className="text-xl font-bold text-brand-dark">Seu Carrinho</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex items-center border border-gray-200 rounded-full px-2 py-1 mr-4 bg-white">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-gray-400"><Minus size={14} strokeWidth={3} /></button>
                      <span className="w-6 text-center text-sm font-bold text-brand-dark">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-brand-primary"><Plus size={14} strokeWidth={3} /></button>
                    </div>
                    <span className="text-sm font-bold text-brand-dark">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-brand-dark">R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>R$ {cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>Taxa de entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-black text-xl pt-2"><span className="text-brand-dark">Total</span><span className="text-brand-secondary">R$ {(cartTotal + deliveryFee).toFixed(2)}</span></div>
              </div>
            )}
          </div>
          <div className="p-6 bg-white">
            <button onClick={() => setCurrentScreen('checkout')} className="w-full bg-brand-primary text-white rounded-full py-4 font-bold text-lg shadow-md">Escolher Pagamento</button>
          </div>
        </div>
      )}

      {currentScreen === 'checkout' && (
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="bg-white p-4 flex items-center border-b border-gray-100">
            <button onClick={() => setCurrentScreen('cart')} className="p-2 -ml-2 text-brand-dark"><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold text-brand-dark ml-2">Finalizar Pedido</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-bold text-brand-dark mb-2 flex items-center"><MapPin size={18} className="mr-2 text-brand-primary"/> Entrega</h2>
              <p className="text-sm text-gray-600">Endereço Principal</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-bold text-brand-dark mb-3 flex items-center"><CreditCard size={18} className="mr-2 text-brand-primary"/> Pagamento</h2>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-brand-primary rounded-xl bg-brand-light cursor-pointer">
                  <input type="radio" name="payment" defaultChecked className="text-brand-primary" />
                  <span className="ml-3 text-sm font-medium text-brand-dark">PIX (Aprovação na hora)</span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white border-t border-gray-100">
            <button onClick={handleCheckout} className="w-full bg-brand-primary text-white rounded-full py-4 font-bold text-lg shadow-md flex justify-center items-center">
              Fazer Pedido • R$ {(cartTotal + deliveryFee).toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'tracking' && activeOrder && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-4 flex items-center border-b border-gray-100">
            <button onClick={() => { setActiveOrder(null); setCurrentScreen('home'); }} className="p-2 -ml-2 text-brand-dark"><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold text-brand-dark ml-2">Acompanhar Pedido #{activeOrder.id}</h1>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-brand-light rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={48} className="text-brand-primary" />
            </div>
            <h2 className="text-2xl font-bold text-brand-dark text-center mb-2">{getStatusText(activeOrder.status)}</h2>
            <p className="text-center text-sm text-gray-500 mb-8">Atualização em tempo real.</p>
          </div>
        </div>
      )}

      {currentScreen === 'home' && (
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-around py-3 pb-6 px-2 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <button className="flex flex-col items-center text-brand-primary"><Home size={24} /><span className="text-[10px] font-medium mt-1">Início</span></button>
          <button className="flex flex-col items-center text-gray-400"><History size={24} /><span className="text-[10px] font-medium mt-1">Pedidos</span></button>
          <button className="flex flex-col items-center text-gray-400"><User size={24} /><span className="text-[10px] font-medium mt-1">Perfil</span></button>
        </div>
      )}
    </div>
  );
}
