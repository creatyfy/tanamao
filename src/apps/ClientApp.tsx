import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Store, StoreCategory, Product, Order, Coupon } from '../types';
import { Toast } from '../components/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Search, MapPin, Star, Clock, Bike, ChevronLeft, Plus, Minus, ShoppingBag, CheckCircle, History, Home, User, CreditCard, Loader2, X, Store as StoreIcon, LogOut, MessageSquare, Trash2, Ticket, BellRing } from 'lucide-react';

export default function ClientApp({ onExit }: { onExit: () => void }) {
  const { user, profile } = useAuth();
  const { permission: notifPermission, requestPermission, sendNotification } = usePushNotifications();
  const [currentScreen, setCurrentScreen] = useState('home');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => setToast({ message, type });

  // Data
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeCategories, setStoreCategories] = useState<any[]>([]); // Categorias internas da loja
  const [cart, setCart] = useState<any[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Address
  const [userAddress, setUserAddress] = useState<any>(null);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({ cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' });
  const [cepLoading, setCepLoading] = useState(false);

  // Payment, Notes & Coupons
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pix'>('cash');
  const [changeFor, setChangeFor] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Tracking & History
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [ordersHistory, setOrdersHistory] = useState<any[]>([]);

  // Courier Tracking
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationChannel, setLocationChannel] = useState<any>(null);

  // Modals
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Cancel Order States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Review States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<number[]>([]);

  useEffect(() => {
    if (user) fetchHomeData();
  }, [user]);

  useEffect(() => {
    if (currentScreen === 'history') fetchHistory();
    if (currentScreen === 'profile') fetchAddresses();
  }, [currentScreen]);

  useEffect(() => {
    return () => {
      if (locationChannel) supabase.removeChannel(locationChannel);
    };
  }, [locationChannel]);

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      const [catRes, storeRes, addrRes, orderRes] = await Promise.all([
        supabase.from('store_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('stores').select('*').eq('is_approved', true).eq('status', 'active'),
        supabase.from('addresses').select('*').eq('user_id', user!.id).limit(1).maybeSingle(),
        supabase.from('orders').select('*, order_items(*)').eq('client_id', user!.id).not('status', 'in', '("delivered","cancelled")').order('created_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      
      if (catRes.data) setCategories(catRes.data);
      if (storeRes.data) setStores(storeRes.data);
      if (addrRes.data) setUserAddress(addrRes.data);
      
      if (orderRes.data) {
        setActiveOrder(orderRes.data);
        subscribeToOrder(orderRes.data.id);
        
        if (orderRes.data.status === 'delivering' && orderRes.data.courier_id) {
          subscribeToCourierLocation(orderRes.data.courier_id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar home:', error);
      showToast('Erro ao carregar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, stores(name, logo_url), order_items(*)')
        .eq('client_id', user!.id)
        .in('status', ['delivered', 'cancelled'])
        .order('created_at', { ascending: false });
        
      if (data) {
        setOrdersHistory(data);
        
        const { data: existingReviews } = await supabase
          .from('reviews')
          .select('order_id')
          .eq('reviewer_id', user!.id)
          .eq('target_type', 'store');

        if (existingReviews) {
          setReviewedOrderIds(existingReviews.map(r => r.order_id));
        }
      }
    } catch (error) {
      showToast('Erro ao carregar histórico', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const { data } = await supabase.from('addresses').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (data) setUserAddresses(data);
    } catch (error) {
      console.error('Erro ao carregar endereços', error);
    }
  };

  const fetchCep = async () => {
    const cleanCep = addressForm.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return showToast('CEP inválido', 'warning');
    
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) throw new Error('CEP não encontrado');
      
      setAddressForm(prev => ({
        ...prev,
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf
      }));
    } catch (error) {
      showToast('CEP não encontrado', 'error');
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const cleanCep = addressForm.cep.replace(/\D/g, '');
      const { data, error } = await supabase.from('addresses').insert({
        user_id: user!.id,
        street: addressForm.street,
        number: addressForm.number,
        complement: addressForm.complement,
        neighborhood: addressForm.neighborhood,
        city: addressForm.city,
        state: addressForm.state,
        zip_code: cleanCep
      }).select().single();

      if (error) throw error;
      
      setUserAddress(data);
      setShowAddressModal(false);
      showToast('Endereço salvo com sucesso!');
      
      if (currentScreen === 'profile') {
        fetchAddresses();
      } else if (cart.length > 0) {
        setCurrentScreen('checkout');
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar endereço', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAddress = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Endereço',
      message: 'Tem certeza que deseja excluir este endereço da sua conta?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await supabase.from('addresses').delete().eq('id', id);
          showToast('Endereço excluído com sucesso');
          
          const remaining = userAddresses.filter(a => a.id !== id);
          setUserAddresses(remaining);
          
          if (userAddress?.id === id) {
            setUserAddress(remaining.length > 0 ? remaining[0] : null);
          }
        } catch (error) {
          showToast('Erro ao excluir endereço', 'error');
        }
      }
    });
  };

  const openStore = async (store: Store) => {
    setSelectedStore(store);
    setLoading(true);
    setCurrentScreen('store');
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', store.id).eq('is_available', true),
        supabase.from('product_categories').select('*').eq('store_id', store.id).eq('is_active', true).order('sort_order')
      ]);
      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setStoreCategories(catRes.data);
    } catch (error) {
      showToast('Erro ao carregar cardápio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    if (cart.length > 0 && cart[0].store_id !== product.store_id) {
      setPendingProduct(product);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
    showToast('Adicionado ao carrinho');
  };

  const confirmClearCart = () => {
    if (pendingProduct) {
      setCart([{ ...pendingProduct, quantity: 1 }]);
      setPendingProduct(null);
      setAppliedCoupon(null);
      setCouponCode('');
      showToast('Carrinho atualizado');
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = selectedStore?.delivery_fee || 0;
  
  // Coupon Logic
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' 
        ? Math.min(cartTotal, cartTotal * (appliedCoupon.value / 100)) 
        : Math.min(cartTotal, appliedCoupon.value))
    : 0;
    
  const finalTotal = Math.max(0, cartTotal - discountAmount) + deliveryFee;

  // Revalidate coupon if cart total changes
  useEffect(() => {
    if (appliedCoupon && cartTotal < appliedCoupon.min_order_value) {
      setAppliedCoupon(null);
      showToast(`Cupom removido. O valor mínimo é R$ ${appliedCoupon.min_order_value.toFixed(2)}`, 'warning');
    }
  }, [cartTotal]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !selectedStore) return;
    setValidatingCoupon(true);
    try {
      const { data: coupons, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().replace(/\s+/g, ''))
        .eq('store_id', selectedStore.id)
        .eq('is_active', true);

      if (error) throw error;
      if (!coupons || coupons.length === 0) {
        showToast('Cupom inválido ou não pertence a esta loja.', 'error');
        return;
      }

      const coupon = coupons[0];

      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        showToast('Este cupom já expirou.', 'error');
        return;
      }

      if (cartTotal < coupon.min_order_value) {
        showToast(`Valor mínimo para este cupom é R$ ${coupon.min_order_value.toFixed(2)}`, 'warning');
        return;
      }

      if (coupon.max_uses) {
        const { count } = await supabase.from('coupon_usages').select('*', { count: 'exact', head: true }).eq('coupon_id', coupon.id);
        if (count !== null && count >= coupon.max_uses) {
          showToast('Este cupom atingiu o limite de usos.', 'error');
          return;
        }
      }

      if (coupon.max_uses_per_user) {
        const { count } = await supabase.from('coupon_usages').select('*', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('user_id', user!.id);
        if (count !== null && count >= coupon.max_uses_per_user) {
          showToast('Você já atingiu o limite de usos deste cupom.', 'error');
          return;
        }
      }

      setAppliedCoupon(coupon);
      showToast('Cupom aplicado com sucesso!', 'success');
    } catch (err) {
      showToast('Erro ao validar cupom.', 'error');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const proceedToCheckout = () => {
    if (!userAddress) {
      setShowAddressModal(true);
    } else {
      setCurrentScreen('checkout');
    }
  };

  const handleCheckout = async () => {
    if (!user || !selectedStore || !userAddress) return;
    
    if (paymentMethod === 'cash' && changeFor) {
      const changeValue = parseFloat(changeFor);
      if (changeValue < finalTotal) {
        showToast('O troco não pode ser menor que o total do pedido.', 'warning');
        return;
      }
    }

    setActionLoading(true);
    try {
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        client_id: user.id,
        store_id: selectedStore.id,
        delivery_address_id: userAddress.id,
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        total: finalTotal,
        payment_method: paymentMethod,
        change_for: paymentMethod === 'cash' && changeFor ? parseFloat(changeFor) : null,
        coupon_id: appliedCoupon?.id || null,
        client_notes: clientNotes ? clientNotes : null,
        status: 'pending'
      }).select().single();
      
      if (orderError) throw orderError;

      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));
      
      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      // Register coupon usage
      if (appliedCoupon) {
        await supabase.from('coupon_usages').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
          order_id: order.id
        });
      }

      setCart([]);
      setClientNotes('');
      setCouponCode('');
      setAppliedCoupon(null);
      setActiveOrder({ ...order, order_items: orderItems });
      setCurrentScreen('tracking');
      subscribeToOrder(order.id);
      
      // Request permission if not granted yet, since they just made an order
      if (notifPermission === 'default') {
        requestPermission();
      }

      showToast('Pedido realizado com sucesso!');
    } catch (error: any) {
      console.error("Erro no checkout:", error);
      showToast(error.message || 'Erro ao finalizar pedido.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrder || !cancelReason) return;
    setCancelLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_by: 'client',
          cancel_reason: cancelReason
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      setShowCancelModal(false);
      setCancelReason('');
      setActiveOrder(null);
      setCurrentScreen('home');
      showToast('Pedido cancelado.', 'warning');
    } catch (err) {
      showToast('Erro ao cancelar pedido.', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewingOrder || reviewRating === 0) return;
    setReviewLoading(true);
    try {
      const { error: reviewError } = await supabase.from('reviews').insert({
        order_id: reviewingOrder.id,
        reviewer_id: user!.id,
        target_type: 'store',
        target_id: reviewingOrder.store_id,
        rating: reviewRating,
        comment: reviewComment || null
      });

      if (reviewError) throw reviewError;

      // Recalcular a média da loja
      const { data: storeReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('target_type', 'store')
        .eq('target_id', reviewingOrder.store_id);

      if (storeReviews && storeReviews.length > 0) {
        const avg = storeReviews.reduce((acc, r) => acc + r.rating, 0) / storeReviews.length;
        await supabase
          .from('stores')
          .update({ avg_rating: parseFloat(avg.toFixed(1)) })
          .eq('id', reviewingOrder.store_id);
      }

      setReviewedOrderIds(prev => [...prev, reviewingOrder.id]);
      setShowReviewModal(false);
      setReviewingOrder(null);
      setReviewRating(0);
      setReviewComment('');
      showToast('Avaliação enviada! Obrigado 🌟', 'success');
    } catch (err) {
      showToast('Erro ao enviar avaliação.', 'error');
    } finally {
      setReviewLoading(false);
    }
  };

  const subscribeToCourierLocation = (courierId: number) => {
    setLocationChannel((prevChannel: any) => {
      if (prevChannel) supabase.removeChannel(prevChannel);
      return null;
    });

    supabase
      .from('couriers')
      .select('last_lat, last_lng')
      .eq('id', courierId)
      .single()
      .then(({ data }) => {
        if (data?.last_lat && data?.last_lng) {
          setCourierLocation({ lat: data.last_lat, lng: data.last_lng });
        }
      });

    const channel = supabase
      .channel(`courier_location_${courierId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: `id=eq.${courierId}`,
        },
        (payload) => {
          const { last_lat, last_lng } = payload.new as any;
          if (last_lat && last_lng) {
            setCourierLocation({ lat: last_lat, lng: last_lng });
          }
        }
      )
      .subscribe();

    setLocationChannel(channel);
  };

  const subscribeToOrder = (orderId: number) => {
    supabase.channel(`order_${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, async (payload) => {
        const updatedOrder = payload.new as Order;
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
        setActiveOrder({ ...updatedOrder, order_items: items || [] });
        
        // Push Notifications para o Cliente
        if (updatedOrder.status === 'delivering') {
          sendNotification('🏍️ Pedido a caminho!', { body: 'Seu pedido saiu para entrega. Acompanhe no mapa!' });
        } else if (updatedOrder.status === 'delivered') {
          sendNotification('🎉 Pedido Entregue!', { body: 'Bom apetite! Não esqueça de avaliar a loja.' });
        }

        if (updatedOrder.status === 'delivering' && updatedOrder.courier_id) {
          subscribeToCourierLocation(updatedOrder.courier_id);
        }

        if (updatedOrder.status === 'delivered') {
          setCourierLocation(null);
          setLocationChannel((prev: any) => {
            if (prev) supabase.removeChannel(prev);
            return null;
          });
          showToast('Seu pedido foi entregue! 🎉', 'success');
        }
      }).subscribe();
  };

  const filteredStores = stores.filter(store => {
    const matchCat = selectedCategory ? store.global_category_id === selectedCategory : true;
    const matchSearch = searchQuery ? store.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  const getTimelineSteps = (status: string) => {
    const steps = [
      { id: 'pending', label: 'Aguardando confirmação', icon: '⏳' },
      { id: 'preparing', label: 'Em preparo', icon: '👨‍🍳' },
      { id: 'ready', label: 'Pronto, aguardando motoboy', icon: '📦' },
      { id: 'delivering', label: 'Saiu para entrega', icon: '🏍️' },
      { id: 'delivered', label: 'Entregue', icon: '🎉' },
    ];
    
    // Se o status for accepted, mapeia visualmente para preparing para simplificar a timeline do cliente
    const effectiveStatus = status === 'accepted' ? 'preparing' : status;
    const currentIndex = steps.findIndex(s => s.id === effectiveStatus);
    
    return steps.map((step, index) => ({
      ...step,
      isPast: index < currentIndex,
      isCurrent: index === currentIndex,
      isFuture: index > currentIndex
    }));
  };

  const showBottomBar = ['home', 'history', 'profile'].includes(currentScreen);

  // Renderizador de Produtos
  const renderProduct = (product: Product) => (
    <div key={product.id} className="flex border-b border-gray-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
      <div className="flex-1 pr-4">
        <h3 className="font-semibold text-brand-dark">{product.name}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        <div className="mt-2 font-bold text-brand-dark">R$ {product.price.toFixed(2)}</div>
      </div>
      <div className="relative shrink-0">
        {product.image_url ? (
          <img src={product.image_url} className="w-24 h-24 rounded-xl object-cover border border-gray-100" alt={product.name} />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 border border-gray-200">
            <StoreIcon size={32} />
          </div>
        )}
        <button onClick={() => addToCart(product)} className="absolute -bottom-2 -right-2 bg-brand-primary text-white p-2 rounded-full shadow-md hover:bg-green-600 transition-transform active:scale-90"><Plus size={16} /></button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-gray-50 flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-8 border-4 border-gray-900">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {loading && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={40}/></div>}
      
      {/* CART CONFLICT MODAL */}
      {pendingProduct && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black text-xl text-gray-800 mb-2">Limpar carrinho?</h3>
            <p className="text-gray-600 text-sm mb-6">Você tem itens de outra loja no carrinho. Deseja limpar o carrinho atual e adicionar este produto?</p>
            <div className="flex space-x-3">
              <button onClick={() => setPendingProduct(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={confirmClearCart} className="flex-[1.5] py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-green-600 transition-colors">Limpar e Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERIC CONFIRM MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black text-xl text-gray-800 mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex space-x-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDRESS MODAL */}
      {showAddressModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:w-[90%] sm:rounded-3xl rounded-t-3xl p-6 animate-in slide-in-from-bottom-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-brand-dark">Onde entregar?</h2>
              <button onClick={() => setShowAddressModal(false)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveAddress} className="space-y-3">
              <div className="flex space-x-2">
                <input type="text" placeholder="CEP" required value={addressForm.cep} onChange={e => setAddressForm({...addressForm, cep: e.target.value})} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                <button type="button" onClick={fetchCep} disabled={cepLoading} className="bg-gray-200 text-brand-dark px-4 rounded-xl font-bold text-sm">
                  {cepLoading ? <Loader2 className="animate-spin" size={18}/> : 'Buscar'}
                </button>
              </div>
              <input type="text" placeholder="Rua" required value={addressForm.street} onChange={e => setAddressForm({...addressForm, street: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              <div className="flex space-x-2">
                <input type="text" placeholder="Número" required value={addressForm.number} onChange={e => setAddressForm({...addressForm, number: e.target.value})} className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                <input type="text" placeholder="Complemento" value={addressForm.complement} onChange={e => setAddressForm({...addressForm, complement: e.target.value})} className="w-2/3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <input type="text" placeholder="Bairro" required value={addressForm.neighborhood} onChange={e => setAddressForm({...addressForm, neighborhood: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              <div className="flex space-x-2">
                <input type="text" placeholder="Cidade" required value={addressForm.city} onChange={e => setAddressForm({...addressForm, city: e.target.value})} className="w-2/3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
                <input type="text" placeholder="UF" required value={addressForm.state} onChange={e => setAddressForm({...addressForm, state: e.target.value})} className="w-1/3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <button type="submit" disabled={actionLoading} className="w-full bg-brand-primary text-white rounded-xl py-4 font-bold mt-4 flex justify-center items-center">
                {actionLoading ? <Loader2 className="animate-spin" size={20}/> : 'Salvar Endereço'}
              </button>
            </form>
          </div>
        </div>
      )}

      {currentScreen === 'home' && (
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="bg-white p-4 rounded-b-3xl shadow-sm relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center text-brand-dark cursor-pointer" onClick={() => setShowAddressModal(true)}>
                <MapPin size={20} className="text-brand-primary mr-1" />
                <span className="font-semibold text-sm truncate max-w-[200px]">
                  {userAddress ? `${userAddress.street}, ${userAddress.number}` : 'Adicionar endereço'}
                </span>
                <ChevronLeft size={16} className="ml-1 rotate-180 text-gray-400" />
              </div>
              {notifPermission === 'default' && (
                <button onClick={requestPermission} className="text-brand-primary bg-brand-light p-2 rounded-full shadow-sm animate-pulse">
                  <BellRing size={18} />
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="O que vamos pedir hoje?" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 rounded-full py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm" 
              />
            </div>
          </div>

          {activeOrder && (
            <div onClick={() => setCurrentScreen('tracking')} className="bg-brand-primary text-white p-3 mx-4 mt-4 rounded-xl shadow-md flex justify-between items-center cursor-pointer animate-pulse">
              <span className="font-bold text-sm flex items-center"><Bike size={18} className="mr-2"/> Pedido em andamento</span>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Acompanhar</span>
            </div>
          )}

          <div className="p-4">
            <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-hide mb-6">
              {categories.map(cat => (
                <div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className="flex flex-col items-center min-w-[70px] cursor-pointer">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm text-2xl mb-2 transition-all ${selectedCategory === cat.id ? 'bg-brand-light border-2 border-brand-primary' : 'bg-white border-2 border-transparent'}`}>
                    {cat.icon || '🍔'}
                  </div>
                  <span className={`text-xs font-medium ${selectedCategory === cat.id ? 'text-brand-primary font-bold' : 'text-brand-dark'}`}>{cat.name}</span>
                </div>
              ))}
            </div>

            <h2 className="font-bold text-brand-dark text-lg mb-4">Lojas Disponíveis</h2>
            <div className="space-y-4">
              {filteredStores.map(store => (
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
              {filteredStores.length === 0 && !loading && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><StoreIcon size={32}/></div>
                  <p className="text-gray-500 font-medium">Nenhuma loja encontrada.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'history' && (
        <div className="flex-1 overflow-y-auto pb-20 bg-gray-50">
          <div className="bg-white p-4 flex items-center border-b border-gray-100 shadow-sm sticky top-0 z-10">
            <h1 className="text-xl font-black text-brand-dark">Meus Pedidos</h1>
          </div>
          <div className="p-4 space-y-4">
            {ordersHistory.length === 0 && !loading ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><ShoppingBag size={40}/></div>
                <p className="text-gray-500 font-medium">Você ainda não fez nenhum pedido.</p>
              </div>
            ) : (
              ordersHistory.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <img src={order.stores?.logo_url || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=100&h=100&fit=crop'} alt={order.stores?.name} className="w-10 h-10 rounded-full object-cover mr-3" />
                      <div>
                        <h3 className="font-bold text-brand-dark">{order.stores?.name}</h3>
                        <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    {order.status === 'delivered' ? (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md flex items-center"><CheckCircle size={10} className="mr-1"/> Entregue</span>
                    ) : (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-md flex items-center"><X size={10} className="mr-1"/> Cancelado</span>
                    )}
                  </div>
                  
                  {order.status === 'cancelled' && order.cancel_reason && (
                    <p className="text-xs text-red-400 mb-2 font-medium">Motivo: {order.cancel_reason}</p>
                  )}

                  <div className="text-sm text-gray-600 mb-3 line-clamp-1">
                    {order.order_items?.map((item:any) => `${item.quantity}x ${item.product_name}`).join(', ')}
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-50 gap-2">
                    <div>
                      <p className="font-black text-brand-dark">R$ {order.total.toFixed(2)}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">{order.payment_method === 'cash' ? '💵 Dinheiro' : '📱 PIX'}</p>
                        {order.discount_amount > 0 && (
                          <span className="text-[10px] text-brand-primary font-bold bg-brand-light px-1.5 rounded flex items-center"><Ticket size={8} className="mr-0.5"/> Desconto</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {order.status === 'delivered' && !reviewedOrderIds.includes(order.id) && (
                        <button
                          onClick={() => {
                            setReviewingOrder(order);
                            setShowReviewModal(true);
                          }}
                          className="text-sm font-bold text-yellow-600 bg-yellow-50 px-3 py-2 rounded-xl border border-yellow-200 flex items-center hover:bg-yellow-100 transition-colors"
                        >
                          <Star size={14} className="mr-1" /> Avaliar
                        </button>
                      )}
                      {order.status === 'delivered' && reviewedOrderIds.includes(order.id) && (
                        <span className="text-xs font-bold text-gray-400 flex items-center px-3 py-2">
                          <Star size={12} className="mr-1 fill-current text-yellow-400" /> Avaliado
                        </span>
                      )}
                      <button onClick={() => {
                        const store = stores.find(s => s.id === order.store_id);
                        if (store) openStore(store);
                        else showToast('Loja indisponível no momento', 'warning');
                      }} className="text-sm font-bold text-brand-primary bg-brand-light px-3 py-2 rounded-xl hover:bg-green-100 transition-colors">
                        Pedir novamente
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {currentScreen === 'profile' && (
        <div className="flex-1 overflow-y-auto pb-20 bg-gray-50">
          <div className="bg-white p-6 border-b border-gray-100 shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-brand-light text-brand-primary rounded-full flex items-center justify-center font-black text-3xl mb-3 shadow-inner">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <h2 className="text-xl font-black text-brand-dark">{profile?.name}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          
          <div className="p-4 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-brand-dark flex items-center"><MapPin size={18} className="mr-2 text-brand-primary"/> Meus Endereços</h3>
                <button onClick={() => setShowAddressModal(true)} className="text-xs font-bold text-brand-primary bg-brand-light px-3 py-1.5 rounded-lg">Adicionar</button>
              </div>
              <div className="space-y-3">
                {userAddresses.length === 0 ? (
                  <p className="text-sm text-gray-500 italic bg-white p-4 rounded-xl border border-gray-100">Nenhum endereço cadastrado.</p>
                ) : (
                  userAddresses.map(addr => (
                    <div key={addr.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                      <div className="flex items-start">
                        <MapPin size={20} className="text-gray-400 mr-3 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{addr.street}, {addr.number} {addr.complement ? `- ${addr.complement}` : ''}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{addr.neighborhood}, {addr.city}/{addr.state}</p>
                          <p className="text-xs text-gray-400 mt-1">CEP: {addr.zip_code}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteAddress(addr.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button onClick={onExit} className="w-full bg-white border border-red-100 text-red-500 py-4 rounded-xl font-bold flex justify-center items-center shadow-sm hover:bg-red-50 transition-colors">
              <LogOut size={20} className="mr-2"/> Sair da Conta
            </button>
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

            <div className="mt-8">
              {/* Produtos com categoria */}
              {storeCategories.map(category => {
                const categoryProducts = products.filter(p => p.category_id === category.id);
                if (categoryProducts.length === 0) return null;

                return (
                  <div key={category.id} className="mb-8">
                    <h2 className="font-black text-brand-dark text-xl mb-4 border-b border-gray-100 pb-2">{category.name}</h2>
                    <div className="space-y-4">
                      {categoryProducts.map(renderProduct)}
                    </div>
                  </div>
                );
              })}

              {/* Produtos sem categoria (Outros) */}
              {products.filter(p => !p.category_id).length > 0 && (
                <div className="mb-8">
                  <h2 className="font-black text-brand-dark text-xl mb-4 border-b border-gray-100 pb-2">Outros</h2>
                  <div className="space-y-4">
                    {products.filter(p => !p.category_id).map(renderProduct)}
                  </div>
                </div>
              )}

              {products.length === 0 && !loading && (
                <div className="text-center py-10 text-gray-500">
                  <p>Nenhum produto disponível no momento.</p>
                </div>
              )}
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
            <button onClick={proceedToCheckout} className="w-full bg-brand-primary text-white rounded-full py-4 font-bold text-lg shadow-md">Escolher Pagamento</button>
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
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="font-bold text-gray-800">{userAddress?.street}, {userAddress?.number}</p>
                <p>{userAddress?.neighborhood} - {userAddress?.city}</p>
              </div>
              <button onClick={() => setShowAddressModal(true)} className="text-xs text-brand-primary font-bold mt-2">Alterar endereço</button>
            </div>

            {/* COUPON SECTION */}
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-bold text-brand-dark mb-3 flex items-center"><Ticket size={18} className="mr-2 text-brand-primary"/> Cupom de Desconto</h2>
              {appliedCoupon ? (
                <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-green-600 mr-3 shadow-sm">
                      <CheckCircle size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-green-800 text-sm">{appliedCoupon.code}</p>
                      <p className="text-xs text-green-600">Desconto de {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}%` : `R$ ${appliedCoupon.value.toFixed(2)}`}</p>
                    </div>
                  </div>
                  <button onClick={() => setAppliedCoupon(null)} className="text-gray-400 hover:text-red-500 p-2"><X size={16}/></button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="Digite o código" 
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none uppercase font-bold tracking-wider"
                  />
                  <button 
                    onClick={handleApplyCoupon} 
                    disabled={validatingCoupon || !couponCode.trim()} 
                    className="bg-brand-dark text-white px-4 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                  >
                    {validatingCoupon ? <Loader2 size={16} className="animate-spin"/> : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-bold text-brand-dark mb-2 flex items-center"><MessageSquare size={18} className="mr-2 text-brand-primary"/> Observações</h2>
              <textarea 
                placeholder="Alguma observação? (ex: tirar cebola, ponto da carne)" 
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none resize-none h-20"
              />
            </div>
            
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-bold text-brand-dark mb-3 flex items-center"><CreditCard size={18} className="mr-2 text-brand-primary"/> Pagamento</h2>
              <div className="space-y-3">
                <label className={`flex flex-col p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-brand-primary bg-brand-light' : 'border-gray-200'}`}>
                  <div className="flex items-center">
                    <input type="radio" name="payment" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="text-brand-primary mr-3" />
                    <span className="text-sm font-bold text-brand-dark">💵 Dinheiro na entrega</span>
                  </div>
                  {paymentMethod === 'cash' && (
                    <div className="mt-3 ml-6">
                      <input 
                        type="number" 
                        placeholder="Troco para R$ (opcional)" 
                        value={changeFor}
                        onChange={e => setChangeFor(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  )}
                </label>
                
                <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'pix' ? 'border-brand-primary bg-brand-light' : 'border-gray-200'}`}>
                  <input type="radio" name="payment" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} className="text-brand-primary mr-3" />
                  <span className="text-sm font-bold text-brand-dark">📱 PIX (Pague ao motoboy)</span>
                </label>
              </div>
            </div>

            {/* RESUMO DE VALORES */}
            <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>R$ {cartTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>Taxa de entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm font-bold text-green-600"><span>Desconto ({appliedCoupon?.code})</span><span>- R$ {discountAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-black text-lg text-brand-dark pt-2 border-t border-gray-100">
                <span>Total</span><span>R$ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
            
          </div>
          <div className="p-4 bg-white border-t border-gray-100">
            <button onClick={handleCheckout} disabled={actionLoading} className="w-full bg-brand-primary text-white rounded-full py-4 font-bold text-lg shadow-md flex justify-center items-center">
              {actionLoading ? <Loader2 className="animate-spin" size={24}/> : `Fazer Pedido • R$ ${finalTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'tracking' && activeOrder && (
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100">
            <h1 className="text-lg font-bold text-brand-dark">Pedido #{activeOrder.id}</h1>
            <div className="flex space-x-2">
              {['pending', 'accepted', 'preparing'].includes(activeOrder.status) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-sm text-red-500 font-bold bg-red-50 px-4 py-1.5 rounded-full hover:bg-red-100 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button onClick={() => setCurrentScreen('home')} className="text-sm text-brand-primary font-bold bg-brand-light px-4 py-1.5 rounded-full">Início</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Payment Banner */}
            <div className={`p-4 rounded-2xl shadow-sm ${activeOrder.payment_method === 'cash' ? 'bg-green-100 border border-green-200' : 'bg-blue-100 border border-blue-200'}`}>
              <h3 className={`font-black text-lg ${activeOrder.payment_method === 'cash' ? 'text-green-800' : 'text-blue-800'}`}>
                {activeOrder.payment_method === 'cash' ? '💵 Pagamento em Dinheiro' : '📱 Pagamento via PIX'}
              </h3>
              <p className={`text-sm mt-1 ${activeOrder.payment_method === 'cash' ? 'text-green-700' : 'text-blue-700'}`}>
                {activeOrder.payment_method === 'cash' 
                  ? `Prepare R$ ${activeOrder.total.toFixed(2)} para o motoboy.${activeOrder.change_for ? ` Troco para R$ ${activeOrder.change_for.toFixed(2)}.` : ''}`
                  : `Combine a chave PIX com o motoboy na entrega. Valor: R$ ${activeOrder.total.toFixed(2)}`}
              </p>
            </div>

            {/* MAP UI */}
            {activeOrder.status === 'delivering' && courierLocation && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center">
                  <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-ping mr-2"></div>
                  <div className="w-2.5 h-2.5 bg-brand-primary rounded-full absolute mr-2 ml-0"></div>
                  <span className="font-bold text-brand-dark text-sm ml-1">🏍️ Motoboy a caminho</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">Ao vivo</span>
                </div>
                <div className="relative w-full h-52">
                  <iframe
                    key={`${courierLocation.lat}-${courierLocation.lng}`}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${courierLocation.lng - 0.008},${courierLocation.lat - 0.008},${courierLocation.lng + 0.008},${courierLocation.lat + 0.008}&layer=mapnik&marker=${courierLocation.lat},${courierLocation.lng}`}
                    title="Localização do motoboy"
                  />
                  <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-gray-500 font-medium shadow-sm">
                    © OpenStreetMap
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-brand-dark mb-6">Acompanhe seu pedido</h2>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                {getTimelineSteps(activeOrder.status).map((step, idx) => (
                  <div key={step.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active ${step.isFuture ? 'opacity-40' : ''}`}>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white z-10 ${step.isCurrent ? 'bg-brand-primary text-white shadow-lg scale-110' : step.isPast ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {step.icon}
                    </div>
                    <div className={`ml-4 md:ml-0 md:w-[calc(50%-2.5rem)] ${step.isCurrent ? 'font-black text-brand-primary' : step.isPast ? 'font-bold text-gray-700' : 'font-medium text-gray-500'}`}>
                      {step.label}
                      {step.id === 'delivering' && step.isCurrent && (
                        <p className="text-xs text-brand-primary mt-1 font-medium animate-pulse">
                          Acompanhe no mapa acima ↑
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Items */}
            {activeOrder.order_items && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-brand-dark mb-3">Resumo do Pedido</h3>
                <div className="space-y-2">
                  {activeOrder.order_items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-600 border-b border-gray-50 pb-2">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="font-medium">R$ {item.total_price.toFixed(2)}</span>
                    </div>
                  ))}
                  {activeOrder.client_notes && (
                    <div className="text-sm text-gray-600 border-b border-gray-50 pb-2">
                      <span className="font-bold">Observações:</span> {activeOrder.client_notes}
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-600 pt-1">
                    <span>Taxa de entrega</span>
                    <span className="font-medium">R$ {activeOrder.delivery_fee.toFixed(2)}</span>
                  </div>
                  {activeOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-sm font-bold text-green-600">
                      <span>Desconto</span>
                      <span>- R$ {activeOrder.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-brand-dark pt-2 text-lg">
                    <span>Total</span>
                    <span>R$ {activeOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showBottomBar && (
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-around py-3 pb-6 px-2 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
          <button onClick={() => setCurrentScreen('home')} className={`flex flex-col items-center transition-colors ${currentScreen === 'home' ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}><Home size={24} /><span className="text-[10px] font-bold mt-1">Início</span></button>
          <button onClick={() => setCurrentScreen('history')} className={`flex flex-col items-center transition-colors ${currentScreen === 'history' ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}><History size={24} /><span className="text-[10px] font-bold mt-1">Pedidos</span></button>
          <button onClick={() => setCurrentScreen('profile')} className={`flex flex-col items-center transition-colors ${currentScreen === 'profile' ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}><User size={24} /><span className="text-[10px] font-bold mt-1">Perfil</span></button>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 pb-8">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-full">
            <h2 className="text-xl font-black text-brand-dark mb-1">Cancelar Pedido</h2>
            <p className="text-sm text-gray-500 mb-5">Selecione o motivo do cancelamento:</p>

            <div className="space-y-2 mb-6">
              {[
                'Errei o pedido',
                'Demorou demais',
                'Vou buscar pessoalmente',
                'Endereço incorreto',
                'Outro motivo'
              ].map(reason => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    cancelReason === reason
                      ? 'border-red-400 bg-red-50 text-red-700 font-bold'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={!cancelReason || cancelLoading}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold disabled:opacity-40 flex justify-center items-center transition-colors"
              >
                {cancelLoading ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {showReviewModal && reviewingOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 pb-8">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-full">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-black text-brand-dark">Como foi?</h2>
                <p className="text-sm text-gray-500">{reviewingOrder.stores?.name}</p>
              </div>
              <button onClick={() => { setShowReviewModal(false); setReviewRating(0); setReviewComment(''); }}>
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="flex justify-center space-x-3 my-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={40}
                    className={star <= reviewRating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
                  />
                </button>
              ))}
            </div>

            {reviewRating > 0 && (
              <p className="text-center text-sm font-bold text-gray-600 -mt-3 mb-4">
                {['', 'Muito ruim 😞', 'Ruim 😕', 'Ok 😐', 'Bom 😊', 'Excelente! 🤩'][reviewRating]}
              </p>
            )}

            <textarea
              placeholder="Deixe um comentário (opcional)..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none resize-none h-20 mb-5"
            />

            <div className="flex space-x-3">
              <button
                onClick={() => { setShowReviewModal(false); setReviewRating(0); setReviewComment(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewRating === 0 || reviewLoading}
                className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold disabled:opacity-40 flex justify-center items-center transition-colors"
              >
                {reviewLoading ? <Loader2 size={18} className="animate-spin" /> : 'Enviar Avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
