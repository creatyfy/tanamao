import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Store, StoreCategory, Product, Order, Coupon, OrderChat } from '../types';
import { Toast } from '../components/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Search, MapPin, Star, Clock, Bike, ChevronLeft, Plus, Minus, ShoppingBag, CheckCircle, History, Home, User, CreditCard, Loader2, X, Store as StoreIcon, LogOut, MessageSquare, Trash2, Ticket, BellRing, Send, Heart, AlertTriangle, Check } from 'lucide-react';

// Função auxiliar para normalizar strings (remove acentos, espaços e deixa minúsculo)
const normalizeString = (str?: string) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

// Mapa ao vivo sem flicker — usa Leaflet via CDN, atualiza marcador sem recarregar
function LiveMap({ lat, lng }: { lat: number; lng: number }) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);

  useEffect(() => {
    // Carrega Leaflet CSS e JS via CDN uma única vez
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!mapRef.current || leafletMapRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      const icon = L.divIcon({
        html: '🏍️',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      leafletMapRef.current = map;
    };

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // inicializa apenas uma vez

  // Atualiza apenas a posição do marcador — sem recarregar o mapa
  useEffect(() => {
    if (markerRef.current && leafletMapRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      leafletMapRef.current.panTo([lat, lng], { animate: true, duration: 1 });
    }
  }, [lat, lng]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '208px', zIndex: 0 }} />
  );
}

export default function ClientApp({ onExit }: { onExit: () => void }) {
  const { user, profile, deleteAccount } = useAuth();
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [editingCpf, setEditingCpf] = useState(false);
  const [cpfInput, setCpfInput] = useState('');
  const [cpfLoading, setCpfLoading] = useState(false);
  const { permission: notifPermission, requestPermission, sendNotification } = usePushNotifications();
  const [currentScreen, setCurrentScreen] = useState('home');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => setToast({ message, type });

  // Data
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]); // Adicionado para busca global de produtos
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeCategories, setStoreCategories] = useState<any[]>([]); // Categorias internas da loja
  const [cart, setCart] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tanamao_cart');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [cartStoreId, setCartStoreId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('tanamao_cart_store_id');
      return saved ? parseInt(saved) : null;
    } catch { return null; }
  });

  // Product modal with subcategories
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSubcategories, setProductSubcategories] = useState<any[]>([]);
  const [subcategorySelections, setSubcategorySelections] = useState<Record<number, any[]>>({});
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<number[]>([]); // Lojas Favoritas
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Address
  const [userAddress, setUserAddress] = useState<any>(null);
  const [userAddresses, setUserAddresses] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [addressForm, setAddressForm] = useState({ cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' });
  const [cepLoading, setCepLoading] = useState(false);

  // Payment, Notes & Coupons
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pix' | 'card'>('cash');
  const [changeFor, setChangeFor] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Asaas Payment States
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixExpiration, setPixExpiration] = useState<string | null>(null);
  const [paymentScreen, setPaymentScreen] = useState<'pix_waiting' | 'card_form' | 'saved_cards'>('pix_waiting');
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedSavedCard, setSelectedSavedCard] = useState<any>(null);
  const [savedCardCvv, setSavedCardCvv] = useState('');
  const [saveCardForLater, setSaveCardForLater] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Tracking & History
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [ordersHistory, setOrdersHistory] = useState<any[]>([]);

  // Courier Tracking
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationChannel, setLocationChannel] = useState<any>(null);
  
  // Refs
  const orderChannelRef = React.useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isChatOpenRef = useRef(false);

  // Modals
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Cancel Order States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<OrderChat[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

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

  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  useEffect(() => {
    if (isChatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (!activeOrder) return;
    supabase.from('order_chats').select('*').eq('order_id', activeOrder.id).order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setChatMessages(data); });
    const channel = supabase.channel(`client_chat_${activeOrder.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_chats', filter: `order_id=eq.${activeOrder.id}` }, (payload) => {
        const msg = payload.new as OrderChat;
        setChatMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.sender_id !== user?.id && !isChatOpenRef.current) showToast('Nova mensagem da loja!', 'success');
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeOrder?.id, user?.id]);

  // Auto-selecionar o primeiro método de pagamento disponível se o atual não for aceito
  useEffect(() => {
    if (currentScreen === 'checkout' && selectedStore) {
      if (paymentMethod === 'cash' && !selectedStore.accepts_cash) {
        setPaymentMethod(selectedStore.accepts_pix ? 'pix' : (selectedStore.accepts_card ? 'card' : 'cash'));
      } else if (paymentMethod === 'pix' && !selectedStore.accepts_pix) {
        setPaymentMethod(selectedStore.accepts_cash ? 'cash' : (selectedStore.accepts_card ? 'card' : 'pix'));
      } else if (paymentMethod === 'card' && !selectedStore.accepts_card) {
        setPaymentMethod(selectedStore.accepts_cash ? 'cash' : (selectedStore.accepts_pix ? 'pix' : 'card'));
      }
    }
  }, [currentScreen, selectedStore, paymentMethod]);

  // Realtime listener para atualizar status de aberto/fechado das lojas instantaneamente
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('public:stores_client')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
        setStores(prevStores => prevStores.map(store => 
          store.id === payload.new.id ? { ...store, is_open: payload.new.is_open } : store
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Realtime listener para atualizar categorias instantaneamente
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('public:store_categories_client')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_categories' }, () => {
        loadCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (currentScreen === 'history') fetchHistory();
    if (currentScreen === 'profile') fetchAddresses();
  }, [currentScreen]);

  useEffect(() => {
    return () => {
      if (locationChannel) supabase.removeChannel(locationChannel);
      if (orderChannelRef.current) supabase.removeChannel(orderChannelRef.current);
    };
  }, [locationChannel]);

  const loadCategories = async () => {
    const { data } = await supabase.from('store_categories').select('*').eq('is_active', true).order('sort_order');
    if (data) {
      const updatedCategories = data.map(cat => {
        const name = normalizeString(cat.name);
        
        if (name.includes('lanche') || name.includes('hamburguer') || name.includes('burger')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/asset-4016aec0-01a3-4b43-bb3c-ed91d84dfd66.webp' };
        } else if (name.includes('pizza')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-24_172608-17e245a4-f2df-44b0-8aa5-1968a34e2217.webp' };
        } else if (name.includes('japonesa') || name.includes('sushi') || name.includes('oriental')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-24_172638-e4b3b10c-e1dd-4279-b4c3-011a69c31c42.webp' };
        } else if (name.includes('brasileira') || name.includes('feijoada') || name.includes('refeicao')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-24_174643-4d9c3a1a-98c1-4e90-bb5f-e34365992a46.webp' };
        } else if (name.includes('doce') || name.includes('sobremesa') || name.includes('pudim')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-24_174715-bce8cbe3-68b1-4819-8bc3-09aa55845925.webp' };
        } else if (name.includes('bebida')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-25_082727-8dab3a55-37ad-47b1-94f8-6575bc4cab4e.webp' };
        } else if (name.includes('saudavel') || name.includes('salada')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-25_082738-4e538ac2-8141-4e78-a36a-b143ae3782b3.webp' };
        } else if (name.includes('acai')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-25_082747-02c1a18b-7dd5-494e-bccb-182e716e9def.webp' };
        } else if (name.includes('mercado') || name.includes('conveniencia')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-25_082758-4fcbaf4a-23da-4818-8cb9-3085448e3384.webp' };
        } else if (name.includes('farmacia')) {
          return { ...cat, icon: 'https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/Captura_de_tela_2026-03-25_082807-3be4bad4-c450-4dcf-ba72-28286d27ef53.webp' };
        } else if (name.includes('salgado')) {
          return { ...cat, icon: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=200&h=200&fit=crop' };
        } else if (name.includes('padaria') || name.includes('pao')) {
          return { ...cat, icon: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop' };
        }
        return cat;
      });
      setCategories(updatedCategories);
    }
  };

  const getApproximateCityFromLocation = async () => {
    if (!navigator.geolocation) return null;

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000
      });
    }).catch(() => null);

    if (!position) return null;

    const { latitude, longitude } = position.coords;
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`);
    if (!response.ok) return null;

    const data = await response.json();
    const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.municipality;
    return city || null;
  };

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      await loadCategories();

      const [addrRes, orderRes, prodRes, favRes] = await Promise.all([
        supabase.from('addresses').select('*').eq('user_id', user!.id).limit(1).maybeSingle(),
        supabase.from('orders').select('*, order_items(*), stores(name, logo_url, avg_prep_time_min), couriers(users(name, avatar_url), vehicle_type, license_plate)').eq('client_id', user!.id).not('status', 'in', '("delivered","cancelled")').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('products').select('store_id, name, description').eq('is_available', true),
        supabase.from('favorite_stores').select('store_id').eq('user_id', user!.id)
      ]);

      if (addrRes.data) setUserAddress(addrRes.data);
      if (prodRes.data) setAllProducts(prodRes.data);
      if (favRes.data) setFavoriteStoreIds(favRes.data.map(f => f.store_id));

      let effectiveCity = addrRes.data?.city || '';

      if (!effectiveCity) {
        const approxCity = await getApproximateCityFromLocation();
        if (approxCity) {
          effectiveCity = approxCity;
          showToast(`Mostrando lojas próximas de ${approxCity}. Cadastre seu endereço para melhorar a precisão.`, 'warning');
        }
      }

      setCityFilter(effectiveCity);

      if (!effectiveCity) {
        setStores([]);
        setShowAddressModal(true);
        showToast('Informe seu endereço para visualizar lojas da sua cidade.', 'warning');
      } else {
        const { data: filteredStores, error: storeErr } = await supabase
          .from('stores')
          .select('*, addresses!inner(city, state, neighborhood)')
          .eq('is_approved', true)
          .eq('status', 'active')
          .ilike('addresses.city', effectiveCity);

        if (storeErr) throw storeErr;
        setStores(filteredStores || []);
      }

      if (orderRes.data) {
        setActiveOrder(orderRes.data);
        subscribeToOrder(orderRes.data.id);

        if (orderRes.data.status === 'delivering' && orderRes.data.courier_id && !orderRes.data.own_delivery) {
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
        .select('*, stores(name, logo_url), order_items(*), couriers(users(name, avatar_url), vehicle_type, license_plate)')
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
      setCityFilter(data.city || '');
      setShowAddressModal(false);
      showToast('Endereço salvo com sucesso!');
      await fetchHomeData();
      
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

  const handleSaveCpf = async () => {
    if (!user) return;

    const cleanCpf = cpfInput.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      showToast('CPF inválido. Digite um CPF com 11 dígitos.', 'warning');
      return;
    }

    setCpfLoading(true);
    try {
      const { error } = await supabase.from('users').update({ cpf: cleanCpf }).eq('id', user.id);
      if (error) throw error;
      showToast('CPF salvo com sucesso!', 'success');
      window.location.reload();
    } catch (error) {
      showToast('Erro ao salvar CPF. Tente novamente.', 'error');
    } finally {
      setCpfLoading(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, storeId: number) => {
    e.stopPropagation();
    if (!user) return;

    const isFav = favoriteStoreIds.includes(storeId);
    
    if (isFav) {
      setFavoriteStoreIds(prev => prev.filter(id => id !== storeId));
      await supabase.from('favorite_stores').delete().eq('user_id', user.id).eq('store_id', storeId);
    } else {
      setFavoriteStoreIds(prev => [...prev, storeId]);
      await supabase.from('favorite_stores').insert({ user_id: user.id, store_id: storeId });
    }
  };

  const openStore = async (store: Store) => {
    setSelectedStore(store);
    setLoading(true);
    setCurrentScreen('store');
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', store.id).eq('is_available', true),
        supabase.from('product_categories').select('*').eq('is_active', true).eq('store_id', store.id).order('sort_order')
      ]);
      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setStoreCategories(catRes.data);
    } catch (error) {
      showToast('Erro ao carregar cardápio', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('tanamao_cart', JSON.stringify(cart));
      if (cart.length > 0) {
        localStorage.setItem('tanamao_cart_store_id', cart[0].store_id.toString());
      } else {
        localStorage.removeItem('tanamao_cart_store_id');
      }
    } catch {}
  }, [cart]);

  const openProductModal = async (product: any) => {
    setSelectedProduct(product);
    setSubcategorySelections({});
    setShowProductModal(true);
    setLoadingSubcategories(true);
    try {
      const { data } = await supabase
        .from('product_subcategories')
        .select('*, subcategory_items(*)')
        .eq('category_id', product.category_id)
        .eq('is_active', true)
        .order('sort_order');
      setProductSubcategories(data || []);
    } catch {}
    setLoadingSubcategories(false);
  };

  const toggleSubcategoryItem = (subcategory: any, item: any) => {
    setSubcategorySelections(prev => {
      const current = prev[subcategory.id] || [];
      const exists = current.find((s: any) => s.id === item.id);
      if (exists) {
        return { ...prev, [subcategory.id]: current.filter((s: any) => s.id !== item.id) };
      }
      if (current.length >= subcategory.max_selections) {
        if (subcategory.max_selections === 1) {
          return { ...prev, [subcategory.id]: [item] };
        }
        showToast(`Máximo de ${subcategory.max_selections} itens para "${subcategory.name}"`, 'warning');
        return prev;
      }
      return { ...prev, [subcategory.id]: [...current, item] };
    });
  };

  const getSelectionsTotal = () => {
    return Object.values(subcategorySelections).flat().reduce((acc: number, item: any) => acc + Number(item.price || 0), 0);
  };

  const canAddToCart = () => {
    if (!selectedProduct) return false;
    return productSubcategories.every(sub => {
      if (!sub.is_required) return true;
      const selected = subcategorySelections[sub.id] || [];
      return selected.length >= sub.min_selections;
    });
  };

  const addToCartWithSelections = () => {
    if (!selectedProduct) return;
    const selections = Object.values(subcategorySelections).flat() as any[];
    const itemTotal = Number(selectedProduct.price) + getSelectionsTotal();
    const cartItem = {
      ...selectedProduct,
      quantity: 1,
      price: itemTotal,
      base_price: Number(selectedProduct.price),
      selections,
      cart_key: `${selectedProduct.id}_${Date.now()}`,
    };

    if (cart.length > 0 && cart[0].store_id !== selectedProduct.store_id) {
      setPendingProduct(cartItem);
      setShowProductModal(false);
      return;
    }

    setCart(prev => [...prev, cartItem]);
    setShowProductModal(false);
    showToast('Adicionado ao carrinho! 🛒');
  };

  const addToCart = (product: Product) => {
    if (cart.length > 0 && cart[0].store_id !== product.store_id) {
      setPendingProduct(product);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && !item.selections?.length);
      if (existing) return prev.map(item => item.id === product.id && !item.selections?.length ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1, cart_key: `${product.id}_${Date.now()}` }];
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

  const updateQuantity = (cartKeyOrId: any, delta: number) => {
    setCart(prev => {
      const newCart = prev.map(item => {
        const match = item.cart_key ? item.cart_key === cartKeyOrId : item.id === cartKeyOrId;
        if (match) return { ...item, quantity: item.quantity + delta };
        return item;
      }).filter(item => item.quantity > 0);
      return newCart;
    });
  };

  // FIX: Conversão rigorosa para Number para evitar concatenação de strings com valores do banco
  const cartTotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  const deliveryFee = Number(selectedStore?.delivery_fee || 0);
  
  // Coupon Logic
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' 
        ? Math.min(cartTotal, cartTotal * (Number(appliedCoupon.value) / 100)) 
        : Math.min(cartTotal, Number(appliedCoupon.value)))
    : 0;
    
  // FIX: Cálculo seguro com valores convertidos
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
    if ((paymentMethod === 'pix' || paymentMethod === 'card') && !profile?.cpf) {
      showToast('Você precisa informar seu CPF para pagar com PIX ou cartão. Acesse seu Perfil para atualizar.', 'warning');
      setCurrentScreen('profile');
      return;
    }
    
    // Bloqueia se a loja fechou depois que o cliente abriu o cardápio
    // Verify store is still open before placing order
    const { data: freshStore } = await supabase.from('stores').select('is_open').eq('id', selectedStore.id).single();
    if (!freshStore?.is_open) {
      showToast('A loja está fechada no momento. Aguarde ela reabrir.', 'error');
      return;
    }

    if (!selectedStore.is_open) {
      showToast('Esta loja fechou. Não é possível finalizar o pedido.', 'error');
      return;
    }
    
    if (paymentMethod === 'cash' && changeFor) {
      const changeValue = parseFloat(changeFor);
      if (changeValue < finalTotal) {
        showToast('O troco não pode ser menor que o total do pedido.', 'warning');
        return;
      }
    }

    setActionLoading(true);
    try {
      // Gera código de 4 dígitos aleatório
      const deliveryCode = String(Math.floor(1000 + Math.random() * 9000));

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
        status: 'pending',
        delivery_code: deliveryCode
      }).select().single();
      
      if (orderError) throw orderError;

      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: Number(item.price),
        total_price: Number(item.price) * item.quantity
      }));
      
      const { error: itemsErr, data: insertedItems } = await supabase.from('order_items').insert(orderItems).select();
      if (itemsErr) throw itemsErr;

      // Save subcategory selections
      if (insertedItems) {
        const allSelections: any[] = [];
        cart.forEach((item, idx) => {
          if (item.selections?.length && insertedItems[idx]) {
            item.selections.forEach((sel: any) => {
              allSelections.push({
                order_item_id: insertedItems[idx].id,
                subcategory_item_id: sel.id,
                subcategory_id: sel.subcategory_id || 0,
                item_name: sel.name,
                item_price: Number(sel.price || 0),
                quantity: 1,
              });
            });
          }
        });
        if (allSelections.length > 0) {
          await supabase.from('order_item_selections').insert(allSelections);
        }
      }

      // Register coupon usage
      if (appliedCoupon) {
        await supabase.from('coupon_usages').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
          order_id: order.id
        });
      }

      if (paymentMethod === 'cash') {
        setCart([]);
        setClientNotes('');
        setCouponCode('');
        setAppliedCoupon(null);
        setActiveOrder({ ...order, order_items: orderItems, stores: { name: selectedStore.name, logo_url: selectedStore.logo_url, avg_prep_time_min: selectedStore.avg_prep_time_min } });
        setCurrentScreen('tracking');
        subscribeToOrder(order.id);
        if (notifPermission === 'default') requestPermission();
        showToast('Pedido realizado com sucesso!');
      } else if (paymentMethod === 'pix') {
        setPaymentLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const { data: payData, error: payErr } = await supabase.functions.invoke('create-payment', {
            body: { orderId: order.id, method: 'PIX' },
            headers: { Authorization: `Bearer ${session?.access_token}` }
          });
          if (payErr || !payData?.success) {
            console.error("Payment Error:", payErr, payData);
            throw new Error(payData?.error || payErr?.message || 'Erro ao gerar PIX. Tente novamente.');
          }
          setPixQrCode(payData.pixQrCode);
          setPixCopyPaste(payData.pixCopyPaste);
          setPixExpiration(payData.pixExpiration);
          setActiveOrder({ ...order, order_items: orderItems, stores: { name: selectedStore.name, logo_url: selectedStore.logo_url, avg_prep_time_min: selectedStore.avg_prep_time_min } });
          subscribeToOrder(order.id);
          setCart([]);
          setClientNotes('');
          setCouponCode('');
          setAppliedCoupon(null);
          setPaymentScreen('pix_waiting');
          setCurrentScreen('payment');
        } finally {
          setPaymentLoading(false);
        }
      } else if (paymentMethod === 'card') {
        setActiveOrder({ ...order, order_items: orderItems, stores: { name: selectedStore.name, logo_url: selectedStore.logo_url, avg_prep_time_min: selectedStore.avg_prep_time_min } });
        subscribeToOrder(order.id);
        setCart([]);
        setClientNotes('');
        setCouponCode('');
        setAppliedCoupon(null);
        
        // Carrega cartões salvos do usuário
        const { data: cards } = await supabase
          .from('saved_cards')
          .select('*')
          .eq('user_id', user!.id)
          .order('is_default', { ascending: false });
        setSavedCards(cards || []);
        setSelectedSavedCard(cards?.[0] || null);
        setSavedCardCvv('');
        setPaymentScreen(cards && cards.length > 0 ? 'saved_cards' : 'card_form');
        
        setCurrentScreen('payment');
      }
    } catch (error: any) {
      console.error("Erro no checkout:", error);
      showToast(error.message || 'Erro ao finalizar pedido.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCardPayment = async () => {
    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      let body: any = { orderId: activeOrder!.id, method: 'CREDIT_CARD' };

      if (selectedSavedCard && savedCardCvv) {
        // Pagando com cartão salvo — envia dados de exibição + CVV digitado agora
        body.savedCardData = {
          holderName: selectedSavedCard.holder_name,
          number: '000000000000' + selectedSavedCard.last_four, // placeholder, não usado para cobrança real sem tokenização
          expiryMonth: selectedSavedCard.expiry_month,
          expiryYear: selectedSavedCard.expiry_year,
          ccv: savedCardCvv,
        };
      } else {
        // Cartão novo
        if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) {
          showToast('Preencha todos os dados do cartão', 'error');
          return;
        }
        body.cardData = {
          holderName: cardData.name,
          number: cardData.number.replace(/\s/g, ''),
          expiryMonth: cardData.expiry.split('/')[0],
          expiryYear: '20' + cardData.expiry.split('/')[1],
          ccv: cardData.cvv,
        };

        // Salvar cartão se o usuário marcou a opção
        if (saveCardForLater) {
          const number = cardData.number.replace(/\s/g, '');
          const firstDigit = number[0];
          const brand = firstDigit === '4' ? 'Visa' : firstDigit === '5' ? 'Mastercard' : firstDigit === '3' ? 'Amex' : 'Cartão';
          await supabase.from('saved_cards').insert({
            user_id: user!.id,
            brand,
            last_four: number.slice(-4),
            holder_name: cardData.name,
            expiry_month: cardData.expiry.split('/')[0],
            expiry_year: '20' + cardData.expiry.split('/')[1],
            is_default: savedCards.length === 0,
          });
        }
      }

      const { data: payData, error: payErr } = await supabase.functions.invoke('create-payment', {
        body,
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (payErr || !payData?.success) {
        throw new Error(payData?.error || payErr?.message || 'Pagamento recusado. Verifique os dados do cartão.');
      }
      showToast('Pagamento aprovado! 🎉', 'success');
      setCurrentScreen('tracking');
    } catch (err: any) {
      showToast(err.message || 'Erro no pagamento', 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRequestCancel = async () => {
    if (!activeOrder || !cancelReason) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.from('order_chats').insert({
        order_id: activeOrder.id, sender_id: user!.id,
        message: `⚠️ Solicitação de Cancelamento: ${cancelReason}`,
        is_system_message: true
      }).select().single();
      if (error) throw error;
      if (data) setChatMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
      setShowCancelModal(false); setCancelReason(''); setIsChatOpen(true);
    } catch { showToast('Erro ao enviar solicitação.', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleBackToHomeAfterCancellation = () => {
    if (orderChannelRef.current) {
      supabase.removeChannel(orderChannelRef.current);
      orderChannelRef.current = null;
    }
    setActiveOrder(null);
    setCurrentScreen('home');
    setCart([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeOrder) return;
    const text = chatInput.trim(); setChatInput(''); setChatLoading(true);
    try {
      const { data, error } = await supabase.from('order_chats').insert({
        order_id: activeOrder.id, sender_id: user!.id, message: text, is_system_message: false
      }).select().single();
      if (error) throw error;
      if (data) setChatMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
    } catch { showToast('Erro ao enviar mensagem', 'error'); }
    finally { setChatLoading(false); }
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
    // Remove canal anterior de forma síncrona via ref
    if (orderChannelRef.current) {
      supabase.removeChannel(orderChannelRef.current);
      orderChannelRef.current = null;
    }

    const channel = supabase.channel(`order_${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, async (payload) => {
        const updatedOrder = payload.new as Order;
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
        setActiveOrder(prev => prev ? { ...prev, ...updatedOrder, order_items: items || [], stores: prev.stores } : { ...updatedOrder, order_items: items || [] } as any);
        
        // Se pagamento PIX foi confirmado, redireciona para tracking
        if ((updatedOrder as any).payment_status === 'confirmed' && currentScreen === 'payment') {
          setCurrentScreen('tracking');
          showToast('Pagamento confirmado! ✅', 'success');
        }
        if (updatedOrder.status === 'delivering') {
          sendNotification('🏍️ Pedido a caminho!', { body: 'Seu pedido saiu para entrega. Acompanhe no mapa!' });
        } else if (updatedOrder.status === 'delivered') {
          sendNotification('🎉 Pedido Entregue!', { body: 'Bom apetite! Não esqueça de avaliar a loja.' });
        } else if (updatedOrder.status === 'cancelled') {
          sendNotification('❌ Pedido Cancelado', { body: 'Seu pedido foi cancelado pela loja.' });
        }
        if (updatedOrder.status === 'delivering' && updatedOrder.courier_id && !updatedOrder.own_delivery) {
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
      })
      .subscribe();

    orderChannelRef.current = channel;
  };

  const filteredStores = stores.filter(store => {
    // Filtro por categoria
    const matchCat = selectedCategory ? store.global_category_id === selectedCategory : true;
    
    // Filtro por busca (Nome da loja ou Nome/Descrição do produto)
    const searchNormalized = normalizeString(searchQuery);
    const matchSearch = searchQuery
      ? normalizeString(store.name).includes(searchNormalized) ||
        allProducts.some(p => p.store_id === store.id && (
          normalizeString(p.name).includes(searchNormalized) || 
          normalizeString(p.description).includes(searchNormalized)
        ))
      : true;

    // Filtro por cidade inteligente (ignora acentos e maiúsculas)
    const clientCity = normalizeString(userAddress?.city || cityFilter);
    const storeCity = normalizeString(store.addresses?.city);
    
    const matchCity = (clientCity && storeCity)
      ? clientCity === storeCity
      : true;

    return matchCat && matchSearch && matchCity;
  });

  // Separar abertas e fechadas para mostrar fechadas por último e ordenar por favoritos
  const openStores = filteredStores.filter(s => s.is_open);
  const closedStores = filteredStores.filter(s => !s.is_open);
  
  const sortFavoritesFirst = (a: Store, b: Store) => {
    const aFav = favoriteStoreIds.includes(a.id) ? 1 : 0;
    const bFav = favoriteStoreIds.includes(b.id) ? 1 : 0;
    return bFav - aFav;
  };

  openStores.sort(sortFavoritesFirst);
  closedStores.sort(sortFavoritesFirst);

  const sortedStores = [...openStores, ...closedStores];

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
  const renderProduct = (product: any) => (
    <div key={product.id} onClick={() => openProductModal(product)} className="flex border-b border-gray-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors">
      <div className="flex-1 pr-4">
        <h3 className="font-semibold text-brand-dark">{product.name}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        <div className="mt-2 font-bold text-brand-dark">R$ {Number(product.price).toFixed(2)}</div>
      </div>
      <div className="relative shrink-0">
        {product.image_url ? (
          <img src={product.image_url} className="w-24 h-24 rounded-xl object-cover border border-gray-100" alt={product.name} />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 border border-gray-200">
            <StoreIcon size={32} />
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); openProductModal(product); }} className="absolute -bottom-2 -right-2 bg-brand-primary text-white p-2 rounded-full shadow-md hover:bg-green-600 transition-transform active:scale-90"><Plus size={16} /></button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto h-screen bg-gray-50 flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[900px] sm:my-8 md:max-w-2xl md:h-[95vh] border-4 border-gray-900" style={{paddingTop: 'env(safe-area-inset-top, 0px)'}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {loading && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={40}/></div>}
      
      {/* PRODUCT MODAL WITH SUBCATEGORIES */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="relative shrink-0">
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-48 object-cover rounded-t-3xl" />
              ) : (
                <div className="w-full h-32 bg-gray-100 rounded-t-3xl flex items-center justify-center text-gray-300"><StoreIcon size={48}/></div>
              )}
              <button onClick={() => setShowProductModal(false)} className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-md"><X size={20}/></button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h2 className="text-xl font-black text-brand-dark">{selectedProduct.name}</h2>
                {selectedProduct.description && <p className="text-sm text-gray-500 mt-1">{selectedProduct.description}</p>}
                <p className="text-lg font-bold text-brand-primary mt-2">R$ {Number(selectedProduct.price).toFixed(2)}</p>
              </div>

              {loadingSubcategories && (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-brand-primary" size={24}/></div>
              )}

              {productSubcategories.map(sub => (
                <div key={sub.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-brand-dark text-sm">{sub.name}</h3>
                      {sub.description && <p className="text-xs text-gray-500">{sub.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      {sub.is_required && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Obrigatório</span>}
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {sub.max_selections === 1 ? 'Escolha 1' : `Até ${sub.max_selections}`}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {(sub.subcategory_items || []).filter((i: any) => i.is_available).map((item: any) => {
                      const selected = (subcategorySelections[sub.id] || []).find((s: any) => s.id === item.id);
                      return (
                        <button key={item.id} onClick={() => toggleSubcategoryItem(sub, item)}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${selected ? 'bg-brand-light' : 'hover:bg-gray-50'}`}>
                          {item.image_url && <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0"/>}
                          <div className="flex-1 text-left">
                            <p className="font-medium text-sm text-brand-dark">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {Number(item.price) > 0 && <span className="text-sm font-bold text-brand-primary">+R$ {Number(item.price).toFixed(2)}</span>}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'bg-brand-primary border-brand-primary' : 'border-gray-300'}`}>
                              {selected && <Check size={12} className="text-white"/>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="p-4 border-t border-gray-100 shrink-0">
              <button
                onClick={addToCartWithSelections}
                disabled={!canAddToCart()}
                className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black text-base flex items-center justify-between px-5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
              >
                <span>Adicionar ao carrinho</span>
                <span>R$ {(Number(selectedProduct.price) + getSelectionsTotal()).toFixed(2)}</span>
              </button>
              {!canAddToCart() && (
                <p className="text-center text-xs text-red-500 mt-2">Selecione os itens obrigatórios para continuar</p>
              )}
            </div>
          </div>
        </div>
      )}

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
        <div className="flex-1 overflow-y-auto" style={{paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'}}>
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
            <div onClick={() => setCurrentScreen('tracking')} className={`text-white p-3 mx-4 mt-4 rounded-xl shadow-md flex justify-between items-center cursor-pointer transition-colors ${activeOrder.status === 'cancelled' ? 'bg-red-500' : 'bg-brand-primary animate-pulse'}`}>
              <span className="font-bold text-sm flex items-center">
                {activeOrder.status === 'cancelled' ? <><XCircle size={18} className="mr-2"/> Pedido Cancelado</> : <><Bike size={18} className="mr-2"/> Pedido em andamento</>}
              </span>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full">Ver</span>
            </div>
          )}

          <div className="p-4">
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 snap-x mb-4 custom-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id);
                  }}
                  className="group flex flex-col items-center min-w-[76px] snap-start cursor-pointer outline-none transition-transform active:scale-95 touch-manipulation select-none"
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 shadow-sm border transition-colors overflow-hidden
                    ${selectedCategory === cat.id ? 'bg-brand-primary border-brand-primary' : 'bg-white border-gray-100'}
                  `}>
                    {cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('data:')) ? (
                      <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className={`text-3xl ${selectedCategory === cat.id ? 'text-white' : ''}`}>{cat.icon || '🍔'}</span>
                    )}
                  </div>
                  <span className={`text-xs font-bold text-center line-clamp-1 ${
                    selectedCategory === cat.id ? 'text-brand-primary' : 'text-gray-600'
                  }`}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>

            <h2 className="font-bold text-brand-dark text-lg mb-4">Lojas Disponíveis</h2>
            <div className="space-y-4">
              {sortedStores.map(store => (
                <div
                  key={store.id}
                  onClick={() => store.is_open ? openStore(store) : showToast('Esta loja está fechada no momento.', 'warning')}
                  className={`bg-white p-3 rounded-2xl shadow-sm flex items-center transition-transform ${store.is_open ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed opacity-60'}`}
                >
                  <div className="relative">
                    <img
                      src={store.logo_url || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=200&fit=crop'}
                      alt={store.name}
                      className={`w-16 h-16 rounded-xl object-cover ${!store.is_open ? 'grayscale' : ''}`}
                    />
                    {!store.is_open && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                        <span className="text-white text-[9px] font-black uppercase tracking-wider">Fechada</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold truncate pr-2 ${store.is_open ? 'text-brand-dark' : 'text-gray-400'}`}>{store.name}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {!store.is_open && (
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Fechada</span>
                        )}
                        <button 
                          onClick={(e) => toggleFavorite(e, store.id)}
                          className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
                        >
                          <Heart size={16} className={favoriteStoreIds.includes(store.id) ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                      <span className="flex items-center text-brand-secondary font-bold">
                        <Star size={12} className="mr-1 fill-current" /> {store.avg_rating}
                      </span>
                      <span>•</span>
                      <span>{store.avg_prep_time_min} min</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {store.delivery_fee === 0
                        ? <span className="text-brand-primary font-semibold">Entrega Grátis</span>
                        : `Taxa R$ ${store.delivery_fee.toFixed(2)}`}
                    </div>
                  </div>
                </div>
              ))}
              {sortedStores.length === 0 && !loading && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <StoreIcon size={32}/>
                  </div>
                  {userAddress ? (
                    <>
                      <p className="text-gray-500 font-medium">Nenhuma loja encontrada.</p>
                      <p className="text-gray-400 text-sm mt-1">Tente buscar por outro item ou categoria.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 font-medium">Nenhuma loja encontrada.</p>
                      <p className="text-gray-400 text-sm mt-1">Cadastre um endereço para ver lojas disponíveis.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentScreen === 'history' && (
        <div className="flex-1 overflow-y-auto bg-gray-50" style={{paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'}}>
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
                        <p className="text-[10px] text-gray-500 uppercase font-bold">{order.payment_method === 'cash' ? '💵 Dinheiro' : order.payment_method === 'pix' ? '📱 PIX' : '💳 Cartão'}</p>
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
        <div className="flex-1 overflow-y-auto bg-gray-50" style={{paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))'}}>
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

            {!profile?.cpf && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm font-bold text-yellow-800 mb-3">CPF não cadastrado — necessário para PIX e cartão</p>
                {!editingCpf ? (
                  <button
                    onClick={() => setEditingCpf(true)}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-600 transition-colors"
                  >
                    Informar CPF
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={cpfInput}
                      onChange={(e) => setCpfInput(e.target.value)}
                      placeholder="Digite seu CPF"
                      className="w-full px-4 py-3 border border-yellow-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                    />
                    <button
                      onClick={handleSaveCpf}
                      disabled={cpfLoading}
                      className="w-full bg-yellow-500 text-white py-3 rounded-xl font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50 flex justify-center items-center"
                    >
                      {cpfLoading ? <Loader2 size={18} className="animate-spin" /> : 'Salvar CPF'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button onClick={onExit} className="w-full bg-white border border-red-100 text-red-500 py-4 rounded-xl font-bold flex justify-center items-center shadow-sm hover:bg-red-50 transition-colors">
              <LogOut size={20} className="mr-2"/> Sair da Conta
            </button>
            <button onClick={() => setShowDeleteAccountModal(true)} className="w-full bg-white border border-gray-200 text-gray-400 py-3 rounded-xl font-medium flex justify-center items-center shadow-sm hover:bg-gray-50 transition-colors text-sm mt-2">
              <Trash2 size={16} className="mr-2"/> Excluir minha conta
            </button>
          </div>
        </div>
      )}
      {/* Modal de confirmação de exclusão de conta */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Excluir conta?</h2>
              <p className="text-gray-500 text-sm">Esta ação é permanente. Seus dados pessoais serão removidos e você não poderá mais acessar sua conta.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setDeleteAccountLoading(true);
                  try { await deleteAccount(); } finally { setDeleteAccountLoading(false); }
                }}
                disabled={deleteAccountLoading}
                className="w-full bg-red-500 text-white py-4 rounded-xl font-bold flex justify-center items-center disabled:opacity-50"
              >
                {deleteAccountLoading ? <Loader2 size={20} className="animate-spin" /> : 'Sim, excluir minha conta'}
              </button>
              <button onClick={() => setShowDeleteAccountModal(false)} className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-bold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {currentScreen === 'store' && selectedStore && (
        <div className="flex-1 overflow-y-auto bg-white relative" style={{paddingBottom: cart.length > 0 ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : 'calc(3rem + env(safe-area-inset-bottom, 0px))'}}>
          <div className="relative h-40 bg-gray-200 shrink-0">
            {selectedStore.banner_url ? (
              <img src={selectedStore.banner_url} className="w-full h-full object-cover" alt="Banner da Loja" />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                <StoreIcon size={48} />
              </div>
            )}
            <button onClick={() => setCurrentScreen('home')} className="absolute top-4 left-4 bg-white p-2 rounded-full shadow-md text-brand-dark"><ChevronLeft size={20} /></button>
          </div>
          <div className="px-4 pb-4 pt-2 relative">
            <div className="bg-white rounded-2xl shadow-md p-4 -mt-8 relative z-10 border border-gray-100 mb-4">
              <div className="flex justify-between items-start">
                <h1 className="text-2xl font-bold text-brand-dark">{selectedStore.name}</h1>
                <button 
                  onClick={(e) => toggleFavorite(e, selectedStore.id)}
                  className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <Heart size={20} className={favoriteStoreIds.includes(selectedStore.id) ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
                </button>
              </div>
              <div className="flex items-center text-sm text-gray-600 mt-2 space-x-4">
                <span className="flex items-center text-brand-secondary font-bold"><Star size={16} className="mr-1 fill-current" /> {selectedStore.avg_rating}</span>
                <span className="flex items-center"><Clock size={16} className="mr-1" /> {selectedStore.avg_prep_time_min} min</span>
                <span className="flex items-center"><Bike size={16} className="mr-1" /> {selectedStore.delivery_fee === 0 ? 'Grátis' : `R$ ${selectedStore.delivery_fee.toFixed(2)}`}</span>
              </div>
            </div>

            {/* Category Navigation Totems */}
            {storeCategories.length > 0 && (
              <div className="sticky top-0 z-30 bg-white pt-2 pb-2 border-b border-gray-100 -mx-4 px-4 mb-6 shadow-sm">
                <div className="flex space-x-2 overflow-x-auto custom-scrollbar">
                  {storeCategories.map(category => {
                    const hasProducts = products.some(p => p.category_id === category.id);
                    if (!hasProducts) return null;
                    return (
                      <button
                        key={`nav-${category.id}`}
                        onClick={() => {
                          const el = document.getElementById(`category-${category.id}`);
                          if (el) {
                            const y = el.getBoundingClientRect().top + window.scrollY - 100;
                            window.scrollTo({ top: y, behavior: 'smooth' });
                          }
                        }}
                        className="whitespace-nowrap px-4 py-2 bg-gray-100 hover:bg-brand-light text-gray-700 hover:text-brand-primary rounded-full text-sm font-bold transition-colors"
                      >
                        {category.name}
                      </button>
                    )
                  })}
                  {products.filter(p => !p.category_id).length > 0 && (
                    <button
                      onClick={() => {
                        const el = document.getElementById('category-outros');
                        if (el) {
                          const y = el.getBoundingClientRect().top + window.scrollY - 100;
                          window.scrollTo({ top: y, behavior: 'smooth' });
                        }
                      }}
                      className="whitespace-nowrap px-4 py-2 bg-gray-100 hover:bg-brand-light text-gray-700 hover:text-brand-primary rounded-full text-sm font-bold transition-colors"
                    >
                      Outros
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-2">
              {/* Produtos com categoria */}
              {storeCategories.map(category => {
                const categoryProducts = products.filter(p => p.category_id === category.id);
                if (categoryProducts.length === 0) return null;

                return (
                  <div key={category.id} id={`category-${category.id}`} className="mb-8 scroll-mt-24">
                    <h2 className="font-black text-brand-dark text-xl mb-4 border-b border-gray-100 pb-2">{category.name}</h2>
                    <div className="space-y-4">
                      {categoryProducts.map(renderProduct)}
                    </div>
                  </div>
                );
              })}

              {/* Produtos sem categoria (Outros) */}
              {products.filter(p => !p.category_id).length > 0 && (
                <div id="category-outros" className="mb-8 scroll-mt-24">
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
            <div className="fixed sm:absolute left-4 right-4 z-40 max-w-md mx-auto" style={{bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))'}}>
              <button onClick={() => setCurrentScreen('cart')} className="w-full bg-brand-primary text-white rounded-full py-4 px-6 flex justify-between items-center shadow-xl font-bold transition-transform active:scale-95">
                <div className="flex items-center"><span className="bg-white text-brand-primary rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span> Ver carrinho</div>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {currentScreen === 'cart' && (
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-6 flex items-center border-b border-gray-100 shrink-0">
            <button onClick={() => setCurrentScreen('store')} className="text-brand-dark mr-4"><ChevronLeft size={24} strokeWidth={2.5} /></button>
            <h1 className="text-xl font-bold text-brand-dark">Seu Carrinho</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {cart.map((item, idx) => (
                <div key={item.cart_key || item.id || idx} className="flex items-start justify-between">
                  <div className="flex items-start flex-1">
                    <div className="flex items-center border border-gray-200 rounded-full px-2 py-1 mr-3 bg-white shrink-0 mt-0.5">
                      <button onClick={() => updateQuantity(item.cart_key || item.id, -1)} className="p-1 text-gray-400"><Minus size={14} strokeWidth={3} /></button>
                      <span className="w-6 text-center text-sm font-bold text-brand-dark">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cart_key || item.id, 1)} className="p-1 text-brand-primary"><Plus size={14} strokeWidth={3} /></button>
                    </div>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover mr-3 shrink-0 border border-gray-100 mt-0.5" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 mr-3 shrink-0 border border-gray-200 mt-0.5">
                        <StoreIcon size={16} />
                      </div>
                    )}
                    <div className="flex-1">
                      <span className="text-sm font-bold text-brand-dark line-clamp-2 pr-2">{item.name}</span>
                      {item.selections?.length > 0 && (
                        <div className="mt-0.5">
                          {item.selections.map((sel: any, sidx: number) => (
                            <p key={sidx} className="text-xs text-gray-400">↳ {sel.name}{Number(sel.price) > 0 ? ` +R$ ${Number(sel.price).toFixed(2)}` : ''}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-brand-dark shrink-0 mt-0.5">R$ {(Number(item.price) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>R$ {cartTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>Taxa de entrega</span><span>{deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2)}`}</span></div>
                <div className="flex justify-between font-black text-xl pt-2"><span className="text-brand-dark">Total</span><span className="text-brand-secondary">R$ {(cartTotal + deliveryFee).toFixed(2)}</span></div>
              </div>
            )}
          </div>
          <div className="p-6 bg-white shrink-0 border-t border-gray-100">
            <button onClick={proceedToCheckout} className="w-full bg-brand-primary text-white rounded-full py-4 font-bold text-lg shadow-md">Escolher Pagamento</button>
          </div>
        </div>
      )}

      {currentScreen === 'payment' && (
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="bg-white p-4 flex items-center border-b border-gray-100 shrink-0">
            <button onClick={() => setCurrentScreen('store')} className="mr-3 text-gray-500">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-lg font-bold text-brand-dark">
              {paymentScreen === 'pix_waiting' ? '📱 Pagar com PIX' : '💳 Dados do Cartão'}
            </h1>
          </div>

          {paymentScreen === 'pix_waiting' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-sm">
                <p className="text-center text-2xl font-black text-brand-dark mb-1">
                  R$ {activeOrder?.total.toFixed(2)}
                </p>
                <p className="text-center text-sm text-gray-500 mb-6">
                  Escaneie o QR Code ou copie o código PIX
                </p>

                {pixQrCode && (
                  <div className="flex justify-center mb-5">
                    <img
                      src={`data:image/png;base64,${pixQrCode}`}
                      alt="QR Code PIX"
                      className="w-56 h-56 rounded-2xl border-2 border-brand-primary/20"
                    />
                  </div>
                )}

                {pixCopyPaste && (
                  <button
                    onClick={async() => {
                      let copied = false;
                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(pixCopyPaste!);
                          copied = true;
                        }
                      } catch {
                        copied = false;
                      }

                      if (!copied) {
                        const el = document.createElement('textarea');
                        el.value = pixCopyPaste!;
                        el.style.position = 'fixed';
                        el.style.opacity = '0';
                        document.body.appendChild(el);
                        el.focus();
                        el.select();
                        copied = document.execCommand('copy');
                        document.body.removeChild(el);
                      }

                      showToast(copied ? 'Código PIX copiado!' : 'Não foi possível copiar automaticamente. Toque e segure no código ou use o QR Code.', copied ? 'success' : 'warning');
                    }}
                    className="w-full bg-brand-light text-brand-primary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-4"
                  >
                    <CheckCircle size={16} /> Copiar código PIX
                  </button>
                )}

                <p className="text-center text-xs text-gray-400 mb-2">⏱ Expira em 30 minutos</p>
                <div className="flex flex-col items-center mt-2 mb-4">
                  <img src="/logoasaas.png" alt="Asaas" className="h-4 opacity-50 mb-1" />
                  <p className="text-center text-xs text-gray-400">🔒 Pagamento seguro processado pelo Asaas</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-blue-700 text-xs font-medium text-center">
                    Após o pagamento, seu pedido será confirmado automaticamente. Não feche o app.
                  </p>
                </div>
              </div>
            </div>
          )}

          {paymentScreen === 'saved_cards' && (
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
              <h2 className="font-bold text-brand-dark text-lg">Pagar com cartão</h2>

              <div className="space-y-3">
                {savedCards.map(card => (
                  <div
                    key={card.id}
                    onClick={() => setSelectedSavedCard(card)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedSavedCard?.id === card.id ? 'border-brand-primary bg-brand-light' : 'border-gray-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-brand-dark">{card.brand} •••• {card.last_four}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{card.holder_name} · {card.expiry_month}/{card.expiry_year}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedSavedCard?.id === card.id ? 'border-brand-primary bg-brand-primary' : 'border-gray-300'}`}>
                        {selectedSavedCard?.id === card.id && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedSavedCard && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">CVV do cartão selecionado</label>
                  <input
                    type="text" inputMode="numeric" maxLength={4} placeholder="000"
                    value={savedCardCvv}
                    onChange={e => setSavedCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
              )}

              <button
                onClick={handleCardPayment}
                disabled={paymentLoading || !selectedSavedCard || savedCardCvv.length < 3}
                className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center disabled:opacity-50"
              >
                {paymentLoading ? <Loader2 className="animate-spin" size={24} /> : `Pagar R$ ${activeOrder?.total.toFixed(2)}`}
              </button>

              <button
                onClick={() => { setSelectedSavedCard(null); setPaymentScreen('card_form'); }}
                className="w-full text-brand-primary font-bold py-2 text-sm"
              >
                + Usar outro cartão
              </button>

              <div className="flex flex-col items-center mt-2">
                <img src="/logoasaas.png" alt="Asaas" className="h-4 opacity-50 mb-1" />
                <p className="text-center text-xs text-gray-400">🔒 Pagamento seguro processado pelo Asaas</p>
              </div>
            </div>
          )}

          {paymentScreen === 'card_form' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <p className="font-bold text-brand-dark text-center mb-2">
                  Total: R$ {activeOrder?.total.toFixed(2)}
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Número do Cartão</label>
                  <input
                    type="text" inputMode="numeric" maxLength={19}
                    placeholder="0000 0000 0000 0000"
                    value={cardData.number}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      setCardData(p => ({ ...p, number: v.replace(/(\d{4})/g, '$1 ').trim() }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Nome no Cartão</label>
                  <input
                    type="text" placeholder="Como está no cartão"
                    value={cardData.name}
                    onChange={e => setCardData(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Validade</label>
                    <input
                      type="text" inputMode="numeric" maxLength={5} placeholder="MM/AA"
                      value={cardData.expiry}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
                        setCardData(p => ({ ...p, expiry: v }));
                      }}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1">CVV</label>
                    <input
                      type="text" inputMode="numeric" maxLength={4} placeholder="000"
                      value={cardData.cvv}
                      onChange={e => setCardData(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={saveCardForLater}
                    onChange={e => setSaveCardForLater(e.target.checked)}
                    className="w-4 h-4 accent-brand-primary"
                  />
                  <span className="text-sm text-gray-600 font-medium">Salvar cartão para próximas compras</span>
                </label>

                <button
                  onClick={handleCardPayment}
                  disabled={paymentLoading || cardData.number.replace(/\s/g,'').length < 16 || !cardData.name || cardData.expiry.length < 5 || cardData.cvv.length < 3}
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center disabled:opacity-50 mt-2"
                >
                  {paymentLoading ? <Loader2 className="animate-spin" size={24} /> : `Pagar R$ ${activeOrder?.total.toFixed(2)}`}
                </button>

                <div className="flex flex-col items-center mt-2">
                  <img src="/logoasaas.png" alt="Asaas" className="h-4 opacity-50 mb-1" />
                  <p className="text-center text-xs text-gray-400">🔒 Pagamento seguro processado pelo Asaas</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentScreen === 'checkout' && (
        <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
          <div className="bg-white p-4 flex items-center border-b border-gray-100 shrink-0">
            <button onClick={() => setCurrentScreen('cart')} className="p-2 -ml-2 text-brand-dark"><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold text-brand-dark ml-2">Finalizar Pedido</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))'}}>
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
                {selectedStore?.accepts_cash && (
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
                )}
                
                {selectedStore?.accepts_pix && (
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'pix' ? 'border-brand-primary bg-brand-light' : 'border-gray-200'}`}>
                    <input type="radio" name="payment" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} className="text-brand-primary mr-3" />
                    <span className="text-sm font-bold text-brand-dark">📱 PIX (Pague no app)</span>
                  </label>
                )}

                {selectedStore?.accepts_card && (
                  <label className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-brand-primary bg-brand-light' : 'border-gray-200'}`}>
                    <input type="radio" name="payment" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="text-brand-primary mr-3" />
                    <span className="text-sm font-bold text-brand-dark">💳 Cartão (Pague no app)</span>
                  </label>
                )}

                {!selectedStore?.accepts_cash && !selectedStore?.accepts_pix && !selectedStore?.accepts_card && (
                  <p className="text-sm text-red-500 italic">Esta loja não configurou nenhuma forma de pagamento.</p>
                )}
              </div>
            </div>

            {/* RESUMO DOS ITENS */}
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-bold text-brand-dark mb-3 flex items-center"><ShoppingBag size={18} className="mr-2 text-brand-primary"/> Resumo do Pedido</h2>
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div key={item.cart_key || idx} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="text-sm font-bold text-brand-dark">{item.quantity}x {item.name}</span>
                        {item.base_price !== undefined && item.price !== item.base_price && (
                          <span className="text-xs text-gray-400 ml-1">(base: R$ {Number(item.base_price).toFixed(2)})</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-brand-dark shrink-0 ml-2">R$ {(Number(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.selections?.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {item.selections.map((sel: any, sidx: number) => (
                          <p key={sidx} className="text-xs text-gray-500 pl-3">↳ {sel.name}{Number(sel.price) > 0 ? ` +R$ ${Number(sel.price).toFixed(2)}` : ''}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* RESUMO DE VALORES */}
            <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>R$ {cartTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>Taxa de entrega</span><span>{deliveryFee === 0 ? 'Grátis' : `R$ ${deliveryFee.toFixed(2)}`}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm font-bold text-green-600"><span>Desconto ({appliedCoupon?.code})</span><span>- R$ {discountAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-black text-lg text-brand-dark pt-2 border-t border-gray-100">
                <span>Total</span><span>R$ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
            
          </div>
          <div className="bg-white border-t border-gray-100 shrink-0" style={{padding: '1rem', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))'}}>
            <button onClick={handleCheckout} disabled={actionLoading || (!selectedStore?.accepts_cash && !selectedStore?.accepts_pix && !selectedStore?.accepts_card)} className="w-full bg-brand-primary text-white rounded-full py-4 font-bold text-lg shadow-md flex justify-center items-center disabled:opacity-50">
              {actionLoading ? <Loader2 className="animate-spin" size={24}/> : `Fazer Pedido • R$ ${finalTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'tracking' && activeOrder && (
        <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
          <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100 shrink-0">
            <h1 className="text-lg font-bold text-brand-dark">Pedido #{activeOrder.id}</h1>
            <div className="flex space-x-2">
              <button onClick={() => setCurrentScreen('home')} className="text-sm text-brand-primary font-bold bg-brand-light px-4 py-1.5 rounded-full">Início</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12">
            
            {/* AVISO DE CANCELAMENTO */}
            {activeOrder.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mb-4 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <X size={32} />
                </div>
                <h2 className="text-xl font-black text-red-700 mb-1">Pedido Cancelado</h2>
                <p className="text-sm text-red-600">Este pedido foi cancelado pela loja.</p>
                {activeOrder.cancel_reason && (
                  <p className="text-xs text-red-500 font-bold mt-2 bg-red-100/50 p-2 rounded-lg">Motivo: {activeOrder.cancel_reason}</p>
                )}
                <button onClick={handleBackToHomeAfterCancellation} className="mt-5 bg-red-600 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-md hover:bg-red-700 transition-colors">
                  Voltar ao Início
                </button>
              </div>
            )}

            {/* PREVISÃO DE ENTREGA */}
            {activeOrder.status !== 'cancelled' && activeOrder.status !== 'delivered' && activeOrder.stores && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-brand-primary/20 flex items-center mb-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="w-12 h-12 bg-brand-light text-brand-primary rounded-full flex items-center justify-center mr-4 shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">Previsão de Chegada</p>
                  <p className="text-xl font-black text-brand-dark">
                    {(() => {
                      // Usa o horário de criação do pedido como base
                      const orderDate = new Date(activeOrder.created_at);
                      // Tempo de preparo da loja ou 30 min por padrão
                      const prepTime = activeOrder.stores.avg_prep_time_min || 30;
                      // Tempo de entrega estimado (15 min)
                      const deliveryTime = 15;
                      const totalMinutes = prepTime + deliveryTime;
                      
                      // Calcula a janela de tempo (ex: de 45 a 55 minutos após o pedido)
                      const minTime = new Date(orderDate.getTime() + totalMinutes * 60000);
                      const maxTime = new Date(orderDate.getTime() + (totalMinutes + 10) * 60000);
                      
                      const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      return `${formatTime(minTime)} - ${formatTime(maxTime)}`;
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Payment Banner */}
            {activeOrder.status !== 'cancelled' && (
              <div className={`p-4 rounded-2xl shadow-sm ${activeOrder.payment_method === 'cash' ? 'bg-green-100 border border-green-200' : activeOrder.payment_method === 'pix' ? 'bg-blue-100 border border-blue-200' : 'bg-orange-100 border border-orange-200'}`}>
                <h3 className={`font-black text-lg ${activeOrder.payment_method === 'cash' ? 'text-green-800' : activeOrder.payment_method === 'pix' ? 'text-blue-800' : 'text-orange-800'}`}>
                  {activeOrder.payment_method === 'cash' ? '💵 Pagamento em Dinheiro' : activeOrder.payment_method === 'pix' ? '📱 Pagamento via PIX' : '💳 Pagamento no Cartão'}
                </h3>
                <p className={`text-sm mt-1 ${activeOrder.payment_method === 'cash' ? 'text-green-700' : activeOrder.payment_method === 'pix' ? 'text-blue-700' : 'text-orange-700'}`}>
                  {activeOrder.payment_method === 'cash' 
                    ? `Prepare R$ ${activeOrder.total.toFixed(2)} para o motoboy.${activeOrder.change_for ? ` Troco para R$ ${activeOrder.change_for.toFixed(2)}.` : ''}`
                    : activeOrder.payment_method === 'pix' 
                      ? `Pagamento digital via PIX. Valor: R$ ${activeOrder.total.toFixed(2)}`
                      : `Pagamento digital via Cartão. Valor: R$ ${activeOrder.total.toFixed(2)}`}
                </p>
              </div>
            )}

            {/* CÓDIGO DE CONFIRMAÇÃO DE ENTREGA */}
            {activeOrder.status === 'delivering' && activeOrder.delivery_code && (
              <div className="bg-brand-primary/10 border-2 border-brand-primary rounded-2xl p-5 text-center mb-4">
                <p className="text-brand-primary text-xs font-black uppercase tracking-widest mb-2">
                  🔐 Código de Confirmação
                </p>
                <p className="text-5xl font-black text-brand-dark tracking-[0.3em]">
                  {activeOrder.delivery_code}
                </p>
                <p className="text-gray-500 text-xs mt-3 font-medium">
                  Informe este código ao motoboy na entrega
                </p>
              </div>
            )}

            {/* ENTREGA PRÓPRIA UI */}
            {activeOrder.status === 'delivering' && activeOrder.own_delivery && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center mb-4 shrink-0">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mr-3 shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-purple-900 text-sm">Entrega Própria da Loja</h3>
                  <p className="text-xs text-purple-700 mt-0.5">O pedido está a caminho com o entregador da própria loja.</p>
                </div>
              </div>
            )}

            {/* MAP UI */}
            {activeOrder.status === 'delivering' && courierLocation && !activeOrder.own_delivery && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 shrink-0">
                <div className="p-4 border-b border-gray-100 flex items-center">
                  {activeOrder.couriers?.users?.avatar_url ? (
                    <img src={activeOrder.couriers.users.avatar_url} alt="Motoboy" className="w-9 h-9 rounded-full object-cover border-2 border-brand-primary mr-3 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-brand-light border-2 border-brand-primary mr-3 shrink-0 flex items-center justify-center">
                      <Bike size={18} className="text-brand-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-dark text-sm truncate">{activeOrder.couriers?.users?.name || 'Motoboy a caminho'}</p>
                    {activeOrder.couriers?.license_plate && (
                      <p className="text-xs text-gray-400 font-medium">{activeOrder.couriers.license_plate}</p>
                    )}
                  </div>
                  <div className="flex items-center ml-2 shrink-0">
                    <div className="w-2 h-2 bg-brand-primary rounded-full animate-ping mr-1"></div>
                    <span className="text-xs text-gray-400 font-medium">Ao vivo</span>
                  </div>
                </div>
                <LiveMap lat={courierLocation.lat} lng={courierLocation.lng} />
              </div>
            )}

            {/* Timeline */}
            {activeOrder.status !== 'cancelled' && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="font-bold text-brand-dark mb-6">Acompanhe seu pedido</h2>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {getTimelineSteps(activeOrder.status).map((step, idx) => (
                    <div key={step.id} className={`relative flex items-center justify-start group is-active ${step.isFuture ? 'opacity-40' : ''}`}>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white z-10 shrink-0 ${step.isCurrent ? 'bg-brand-primary text-white shadow-lg scale-110' : step.isPast ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {step.icon}
                      </div>
                      <div className={`ml-4 ${step.isCurrent ? 'font-black text-brand-primary' : step.isPast ? 'font-bold text-gray-700' : 'font-medium text-gray-500'}`}>
                        {step.label}
                        {step.id === 'delivering' && step.isCurrent && !activeOrder.own_delivery && (
                          <p className="text-xs text-brand-primary mt-1 font-medium animate-pulse">
                            Acompanhe no mapa acima ↑
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Items */}
            {activeOrder.order_items && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-brand-dark mb-3">Resumo do Pedido</h3>
                <div className="space-y-2">
                  {activeOrder.order_items.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="flex justify-between text-sm text-gray-600 border-b border-gray-50 pb-2">
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
                    <span className="font-medium">{activeOrder.delivery_fee === 0 ? 'Grátis' : `R$ ${activeOrder.delivery_fee.toFixed(2)}`}</span>
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
          
          <div className="bg-white p-4 border-t border-gray-100 shrink-0 z-20">
            <div className="flex gap-3">
              <button onClick={() => setIsChatOpen(true)}
                className="flex-[1.5] bg-[#f0f5ff] border border-[#dbeafe] text-[#1d4ed8] py-3.5 rounded-2xl font-bold flex justify-center items-center text-sm">
                <MessageSquare size={18} className="mr-2" /> Chat com a Loja
              </button>
              {['pending', 'accepted', 'preparing'].includes(activeOrder.status) && (
                <button onClick={() => setShowCancelModal(true)}
                  className="flex-1 text-sm text-red-600 font-bold bg-red-50 py-3.5 rounded-2xl border border-red-100 flex justify-center items-center">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showBottomBar && (
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-around py-3 px-2 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20" style={{paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))'}}>
          <button onClick={() => setCurrentScreen('home')} className={`flex flex-col items-center transition-colors ${currentScreen === 'home' ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}><Home size={24} /><span className="text-[10px] font-bold mt-1">Início</span></button>
          <button onClick={() => setCurrentScreen('history')} className={`flex flex-col items-center transition-colors ${currentScreen === 'history' ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}><History size={24} /><span className="text-[10px] font-bold mt-1">Pedidos</span></button>
          <button onClick={() => setCurrentScreen('profile')} className={`flex flex-col items-center transition-colors ${currentScreen === 'profile' ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}><User size={24} /><span className="text-[10px] font-bold mt-1">Perfil</span></button>
        </div>
      )}

      {/* CHAT MODAL */}
      {isChatOpen && activeOrder && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden">
          <div className="bg-white border-b p-4 flex items-center shrink-0">
            <button onClick={() => setIsChatOpen(false)} className="p-2 -ml-2"><ChevronLeft size={24} /></button>
            <img src={activeOrder.stores?.logo_url || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=100&h=100&fit=crop'} alt={activeOrder.stores?.name || 'Loja'} className="w-10 h-10 rounded-full object-cover ml-2 mr-3" />
            <div>
              <h2 className="font-bold text-brand-dark">{activeOrder.stores?.name || 'Loja'}</h2>
              <p className="text-xs text-gray-500">Pedido #{activeOrder.id}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <MessageSquare size={40} className="mb-2 opacity-50" />
                <p className="text-sm">Envie uma mensagem para a loja.</p>
              </div>
            )}
            {chatMessages.map(msg => {
              if (msg.is_system_message) return (
                <div key={msg.id} className="flex justify-center">
                  <span className="bg-yellow-50 text-yellow-800 text-[11px] font-bold px-3 py-1.5 rounded-full border border-yellow-200 text-center max-w-[85%]">{msg.message}</span>
                </div>
              );
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] p-3 text-sm ${isMine ? 'bg-brand-primary text-white rounded-2xl rounded-tr-sm' : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'}`}>{msg.message}</div>
                  <span className="text-[10px] text-gray-400 mt-1">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 bg-white border-t shrink-0">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Digite sua mensagem..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm outline-none" />
              <button type="submit" disabled={!chatInput.trim() || chatLoading}
                className="w-12 h-12 bg-brand-primary text-white rounded-full flex items-center justify-center disabled:opacity-50">
                {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 pb-8">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-black text-brand-dark mb-1">Solicitar Cancelamento</h2>
            <p className="text-sm text-gray-500 mb-5">Selecione o motivo e enviamos para a loja:</p>
            <div className="space-y-2 mb-6">
              {['Errei o pedido','Demorou demais','Vou buscar pessoalmente','Endereço incorreto','Outro motivo'].map(reason => (
                <button key={reason} onClick={() => setCancelReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${cancelReason === reason ? 'border-red-400 bg-red-50 text-red-700 font-bold' : 'border-gray-200 text-gray-700'}`}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(''); }} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">Voltar</button>
              <button onClick={handleRequestCancel} disabled={!cancelReason || actionLoading}
                className="flex-[1.5] py-3 bg-red-500 text-white rounded-xl font-bold disabled:opacity-40 flex justify-center items-center gap-2">
                {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <><MessageSquare size={18} /> Enviar no Chat</>}
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
                {reviewLoading ? <Loader2 className="animate-spin" /> : 'Enviar Avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
