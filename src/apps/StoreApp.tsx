import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Store, Order, Product, Coupon } from '../types';
import { Toast } from '../components/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { 
  LayoutDashboard, ShoppingBag, Package, DollarSign, LogOut, 
  Check, X, Clock, Plus, Bell, Star, BarChart3, 
  FolderTree, Bike, Settings, Edit2, Trash2, 
  Image as ImageIcon, MapPin, MessageSquare, Loader2, History, Ticket, UploadCloud, BellRing,
  User, CheckCircle, Printer, XCircle, Send, Lock, CreditCard, Store as StoreIcon,
  Menu, ChevronLeft
} from 'lucide-react';

// Sub-component to list items of a subcategory
function SubItemsList({ subcategoryId, storeId, onEdit, onDelete }: { subcategoryId: number, storeId: number, onEdit: (item: any) => void, onDelete: (id: number) => void }) {
  const [items, setItems] = React.useState<any[]>([]);
  React.useEffect(() => {
    supabase.from('subcategory_items').select('*').eq('subcategory_id', subcategoryId).order('sort_order').then(({ data }) => setItems(data || []));
  }, [subcategoryId]);

  if (items.length === 0) return (
    <div className="p-4 text-center text-sm text-gray-400">Nenhum item cadastrado. Clique em "Novo Item" para adicionar.</div>
  );

  return (
    <div className="divide-y divide-gray-50">
      {items.map(item => (
        <div key={item.id} className="p-3 flex items-center gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-400 text-xs">Sem foto</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-brand-dark truncate">{item.name}</p>
            {item.description && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-brand-primary text-sm">{item.price > 0 ? `+R$ ${Number(item.price).toFixed(2)}` : 'Grátis'}</span>
            <button onClick={() => onEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-500"><Edit2 size={14}/></button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StoreApp({ onExit }: { onExit: () => void }) {
  const { user } = useAuth();
  const { permission: notifPermission, requestPermission, sendNotification } = usePushNotifications();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => setToast({ message, type });
  const audioLoopRef = React.useRef<boolean>(false);
  const audioLoopTimeoutRef = React.useRef<number | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const pendingOrderIdsRef = React.useRef<Set<number>>(new Set());

  const stopNotificationSound = () => {
    audioLoopRef.current = false;
    if (audioLoopTimeoutRef.current) {
      clearTimeout(audioLoopTimeoutRef.current);
      audioLoopTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const playNotificationSound = () => {
    if (audioLoopRef.current) return;
    audioLoopRef.current = true;

    const playDing = () => {
      if (!audioLoopRef.current) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const playNote = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        // Sequência: ding-dong-ding
        playNote(1200, 0, 0.3);
        playNote(900, 0.35, 0.3);
        playNote(1200, 0.7, 0.4);
        // Fecha o contexto após tocar e agenda próximo loop
        window.setTimeout(() => {
          try { ctx.close(); } catch(e) {}
          // Agenda próxima repetição se ainda deve tocar
          audioLoopTimeoutRef.current = window.setTimeout(playDing, 2500);
        }, 1400);
      } catch (e) {
        console.warn('Audio não suportado:', e);
        // Tenta de novo mesmo com erro
        audioLoopTimeoutRef.current = window.setTimeout(playDing, 2500);
      }
    };

    playDing();
  };
  

  useEffect(() => {
    const unlockNotificationAudio = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.01);
        window.setTimeout(() => ctx.close(), 50);
      } catch (error) {
        console.warn('Não foi possível desbloquear áudio:', error);
      }
    };

    window.addEventListener('pointerdown', unlockNotificationAudio, { once: true });
    window.addEventListener('keydown', unlockNotificationAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockNotificationAudio);
      window.removeEventListener('keydown', unlockNotificationAudio);
    };
  }, []);

  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]); 
  
  // Dashboard Metrics & Filters
  const [dashboardMetrics, setDashboardMetrics] = useState({ totalOrders: 0, deliveredOrders: 0, cancelledOrders: 0, revenue: 0 });
  const [dashboardFilter, setDashboardFilter] = useState<'today' | '7days' | '15days' | '30days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [storeBalance, setStoreBalance] = useState<number | null>(null);
  const [storeBillingCycle, setStoreBillingCycle] = useState<any>(null);
  const [nextPayoutDate, setNextPayoutDate] = useState<string>('');

  // History Tab
  const [historyFilter, setHistoryFilter] = useState<'today' | 'yesterday' | 'week'>('today');
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [historyPage, setHistoryPage] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const PAGE_SIZE = 20;

  // Product Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', image_url: '', is_available: true, category_id: '' });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', sort_order: '0', is_active: true });

  // Subcategory state
  const [showSubcategoryPanel, setShowSubcategoryPanel] = useState(false);
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<any>(null);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<any>(null);
  const [subcategoryForm, setSubcategoryForm] = useState({ name: '', description: '', min_selections: '0', max_selections: '5', is_required: false });
  const [showSubItemModal, setShowSubItemModal] = useState(false);
  const [editingSubItem, setEditingSubItem] = useState<any>(null);
  const [selectedSubcategoryForItem, setSelectedSubcategoryForItem] = useState<any>(null);
  const [subItems, setSubItems] = useState<any[]>([]);
  const [subItemForm, setSubItemForm] = useState({ name: '', description: '', price: '0', image_url: '' });
  const [subItemImageFile, setSubItemImageFile] = useState<File | null>(null);
  const [subItemImagePreview, setSubItemImagePreview] = useState<string | null>(null);

  // Coupon Modal State
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', type: 'percentage', value: '', min_order_value: '0', expires_at: '', is_active: true });
  const [newCouponCode, setNewCouponCode] = useState<string>('');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [sendingCouponNotif, setSendingCouponNotif] = useState(false);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    phone: '',
    logo_url: '',
    banner_url: '',
    delivery_fee: '',
    min_order_value: '',
    avg_prep_time_min: '',
    accepts_pix: false,
    accepts_card: false,
    accepts_cash: false,
    newPassword: '',
    confirmPassword: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Chat States
  const [activeChatOrderId, setActiveChatOrderId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const storeOrdersChannelRef = React.useRef<any>(null);
  const storeChatsChannelRef = React.useRef<any>(null);

  // Timer para busca de motoboys
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      fetchStoreData();
    }
  }, [user]);

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      if (!store) return;
      
      let startDate = new Date();
      let endDate = new Date();
      
      if (dashboardFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dashboardFilter === '7days') {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dashboardFilter === '15days') {
        startDate.setDate(startDate.getDate() - 15);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dashboardFilter === '30days') {
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dashboardFilter === 'custom') {
        if (!customStartDate || !customEndDate) return; 
        
        const startParts = customStartDate.split('-');
        startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
        startDate.setHours(0, 0, 0, 0);
        
        const endParts = customEndDate.split('-');
        endDate = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
        endDate.setHours(23, 59, 59, 999);
      }

      const { data: periodOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('store_id', store.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (periodOrders) {
        const totalOrders = periodOrders.length;
        const deliveredOrders = periodOrders.filter(o => o.status === 'delivered').length;
        const cancelledOrders = periodOrders.filter(o => o.status === 'cancelled').length;
        const revenue = periodOrders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + o.total, 0);
        setDashboardMetrics({ totalOrders, deliveredOrders, cancelledOrders, revenue });
      }

      // Saldo disponível
      const { data: pendingPayments } = await supabase
        .from('payments')
        .select('split_store_amount, confirmed_at')
        .eq('status', 'confirmed')
        .in('order_id',
          (await supabase
            .from('orders')
            .select('id')
            .eq('store_id', store.id)
          ).data?.map((o: any) => o.id) || []
        );

      const balance = (pendingPayments || []).reduce((acc: number, p: any) => acc + (p.split_store_amount || 0), 0);
      setStoreBalance(balance);

      // Busca ciclo de cobrança atual
      const { data: cycle } = await supabase
        .from('billing_cycles')
        .select('*')
        .eq('store_id', store.id)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cycle) {
        // Ciclo não existe ainda — cria via process-billing
        try {
          await supabase.functions.invoke('process-billing');
          const { data: newCycle } = await supabase
            .from('billing_cycles')
            .select('*')
            .eq('store_id', store.id)
            .order('period_start', { ascending: false })
            .limit(1)
            .maybeSingle();
          setStoreBillingCycle(newCycle || null);
        } catch (e) {
          setStoreBillingCycle(null);
        }
      } else {
        setStoreBillingCycle(cycle);
      }

      // Próxima segunda-feira
      const today = new Date();
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      setNextPayoutDate(nextMonday.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
    };

    if (activeTab === 'dashboard' && store) {
      fetchDashboardMetrics();
    }
  }, [activeTab, dashboardFilter, customStartDate, customEndDate, store, lastUpdate]);

  useEffect(() => {
    if (activeTab === 'history' && store) {
      setHistoryPage(0);
      setHistoryOrders([]);
      setHistoryHasMore(true);
      fetchHistoryOrders(0, false);
    }
    if (activeTab === 'coupons' && store) fetchCoupons(store.id);
    if (activeTab === 'categories' && store) fetchProductCategories(store.id);
    if (activeTab === 'settings' && store) {
      setSettingsForm({
        name: store.name,
        phone: store.phone || '',
        logo_url: store.logo_url || '',
        banner_url: store.banner_url || '',
        delivery_fee: store.delivery_fee?.toString() || '0',
        min_order_value: store.min_order_value?.toString() || '0',
        avg_prep_time_min: store.avg_prep_time_min?.toString() || '30',
        accepts_pix: store.accepts_pix,
        accepts_card: store.accepts_card,
        accepts_cash: store.accepts_cash,
        newPassword: '',
        confirmPassword: ''
      });
      setLogoPreview(store.logo_url || null);
      setBannerPreview(store.banner_url || null);
    }
  }, [activeTab, historyFilter, store, lastUpdate]);

  useEffect(() => {
    if (activeTab === 'chats' && activeChatOrderId)
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orders, activeChatOrderId, activeTab]);


  useEffect(() => {
    const pendingIds = new Set(
      orders
        .filter((order) => order.status === 'pending')
        .map((order) => Number(order.id))
    );

    const hasPendingOrders = pendingIds.size > 0;
    const hasNewPendingOrder = [...pendingIds].some((id) => !pendingOrderIdsRef.current.has(id));
    pendingOrderIdsRef.current = pendingIds;

    if (hasPendingOrders) {
      if (hasNewPendingOrder) {
        sendNotification('🔔 Novo Pedido Recebido!', {
          body: 'Há pedido novo aguardando aceite ou recusa no painel da loja.',
        });
      }
      playNotificationSound();
    } else {
      stopNotificationSound();
    }
  }, [orders]);

  const handleCourierTimeout = async (orderId: number, deliveryId: number) => {
    if (actionLoading === orderId) return;
    setActionLoading(orderId);
    try {
      await supabase.from('deliveries').update({ status: 'cancelled' }).eq('id', deliveryId);
      await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId);
      showToast(`Pedido #${orderId}: Nenhum motoboy aceitou.`, 'warning');
      fetchOrders(store!.id);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Erro no timeout do motoboy', error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    orders.forEach(order => {
      if (order.status === 'ready' && !order.courier_id && order.deliveries) {
        const offer = order.deliveries.find((d: any) => d.status === 'offered');
        if (offer) {
          const elapsed = Date.now() - new Date(offer.created_at).getTime();
          if (elapsed > 60000 && actionLoading !== order.id) {
            handleCourierTimeout(order.id, offer.id);
          }
        }
      }
    });
  }, [now, orders, actionLoading]);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();

      if (storeError) {
        console.warn('Erro ao buscar loja:', storeError.message);
        setLoading(false);
        return;
      }

      if (!storeData) {
        console.warn('Nenhuma loja encontrada para owner_id=' + user!.id);
        setLoading(false);
        return;
      }

      // Busca endereço separado para evitar falha de FK
      const { data: addressData } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (addressData) storeData.addresses = addressData;
        
        const { data: storeReviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('*, users:reviewer_id(name)')
          .eq('target_type', 'store')
          .eq('target_id', storeData.id)
          .order('created_at', { ascending: false });

        if (reviewsError) {
          console.warn(`Aviso reviews(target_id=${storeData.id}):`, reviewsError.message);
        }
          
        let trueAvg = 0;
        if (storeReviews && storeReviews.length > 0) {
          setReviews(storeReviews);
          const sum = storeReviews.reduce((acc, r) => acc + r.rating, 0);
          trueAvg = parseFloat((sum / storeReviews.length).toFixed(1));
        } else {
          setReviews([]);
        }
        
        if (storeData.avg_rating !== trueAvg) {
          const { error: updateRatingError } = await supabase
            .from('stores')
            .update({ avg_rating: trueAvg })
            .eq('id', storeData.id);
          if (updateRatingError) {
            console.warn(`Aviso ao atualizar avg_rating id=${storeData.id}:`, updateRatingError.message);
          }
          storeData.avg_rating = trueAvg;
        }

        setStore(storeData);
        await Promise.all([
          fetchOrders(storeData.id),
          fetchProducts(storeData.id),
          fetchProductCategories(storeData.id),
        ]);
        
        if (storeChatsChannelRef.current) {
          supabase.removeChannel(storeChatsChannelRef.current);
          storeChatsChannelRef.current = null;
        }

        const channelChats = supabase.channel(`store_chats_${storeData.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_chats' }, (payload) => {
            const newMsg = payload.new;
            setOrders(prev => {
              const idx = prev.findIndex(o => o.id === newMsg.order_id);
              if (idx === -1) return prev;
              if (newMsg.sender_id !== user!.id) showToast(`Nova mensagem no pedido #${newMsg.order_id}`, 'success');
              const updated = [...prev];
              const order = { ...updated[idx] };
              if (!order.order_chats?.find((m: any) => m.id === newMsg.id))
                order.order_chats = [...(order.order_chats || []), newMsg];
              updated[idx] = order;
              return updated;
            });
          }).subscribe();

        storeChatsChannelRef.current = channelChats;
    } catch (error) {
      console.warn('Aviso ao carregar dados da loja:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryOrders = async (page = 0, append = false) => {
    if (!store) return;
    setLoading(true);
    try {
      let startDate = new Date();
      let endDate = new Date();
      
      if (historyFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (historyFilter === 'yesterday') {
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (historyFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data } = await supabase
        .from('orders')
        .select('*, users:client_id(name, phone), order_items(*)')
        .eq('store_id', store.id)
        .in('status', ['delivered', 'cancelled'])
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (data) {
        setHistoryOrders(prev => append ? [...prev, ...data] : data);
        setHistoryHasMore(data.length === PAGE_SIZE);
      }
    } catch (error) {
      showToast('Erro ao carregar histórico', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (storeId: number) => {
    const { data, error } = await supabase.from('orders')
      .select(`*, users:client_id(name, phone), order_items(*, order_item_selections(*)), addresses:delivery_address_id(*), order_chats(*), couriers(users(name, phone), vehicle_type, license_plate), deliveries(id, status, created_at, order_id)`)
      .eq('store_id', storeId)
      .in('status', ['pending', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: false });
    if (error) { console.warn(`orders(store_id=${storeId}):`, error.message); return; }
    if (data) {
      setOrders(data);
      // Limpa deliveries expiradas (>65s sem aceite) para nao travar pedidos
      const expiredDeliveries = data.flatMap((o: any) =>
        (o.deliveries || []).filter((d: any) =>
          d.status === 'offered' &&
          (Date.now() - new Date(d.created_at).getTime()) > 65000
        )
      );
      for (const d of expiredDeliveries) {
        supabase.from('deliveries').update({ status: 'cancelled' }).eq('id', d.id).eq('status', 'offered').then(() => {});
        supabase.from('orders').update({ status: 'preparing' }).eq('id', d.order_id).then(() => {});
      }
    }
  };

  useEffect(() => {
    if (!store?.id) return;

    if (storeOrdersChannelRef.current) {
      supabase.removeChannel(storeOrdersChannelRef.current);
      storeOrdersChannelRef.current = null;
    }

    const channelOrders = supabase.channel(`store_orders_${store.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, async (payload) => {
        if (payload.new.status === 'pending') {
          playNotificationSound();
          sendNotification('🔔 Novo Pedido Recebido!', {
            body: `Pedido #${payload.new.id} no valor de R$ ${payload.new.total.toFixed(2)}. Acesse o painel para aceitar.`,
          });
          // FCM para loja com app fechado
          try {
            if (store.owner_id) {
              const { data: tokenData } = await supabase
                .from('push_tokens')
                .select('token')
                .eq('user_id', store.owner_id);
              if (tokenData && tokenData.length > 0) {
                await supabase.functions.invoke('send-push', {
                  body: {
                    title: '🔔 Novo Pedido Recebido!',
                    body: `Pedido #${payload.new.id} no valor de R$ ${Number(payload.new.total).toFixed(2)}. Acesse o painel para aceitar.`,
                    data: { type: 'new_order', orderId: payload.new.id },
                    targetType: 'specific_tokens',
                    tokens: tokenData.map((t: any) => t.token),
                  }
                });
              }
            }
          } catch (err) {
            console.warn('Erro ao enviar push para loja:', err);
          }
        }
        fetchOrders(store.id);
        setLastUpdate(Date.now());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => {
        fetchOrders(store.id);
        setLastUpdate(Date.now());
      })
      .subscribe();

    storeOrdersChannelRef.current = channelOrders;

    return () => {
      if (storeOrdersChannelRef.current) {
        supabase.removeChannel(storeOrdersChannelRef.current);
        storeOrdersChannelRef.current = null;
      }
    };
  }, [store?.id, sendNotification]);

  useEffect(() => {
    if (!store?.id) return;
    const interval = setInterval(() => {
      fetchOrders(store.id);
    }, 10000);
    return () => clearInterval(interval);
  }, [store?.id]);

  useEffect(() => {
    return () => {
      stopNotificationSound();
      if (storeChatsChannelRef.current) {
        supabase.removeChannel(storeChatsChannelRef.current);
        storeChatsChannelRef.current = null;
      }
      if (storeOrdersChannelRef.current) {
        supabase.removeChannel(storeOrdersChannelRef.current);
        storeOrdersChannelRef.current = null;
      }
    };
  }, []);

  const fetchProducts = async (storeId: number) => {
    const { data, error } = await supabase.from('products')
      .select('*, product_categories(name)')
      .eq('store_id', storeId)
      .order('name');
    if (error) { console.warn(`products(store_id=${storeId}):`, error.message); return; }
    if (data) setProducts(data);
  };

  const fetchProductCategories = async (storeId: number) => {
    const { data, error } = await supabase.from('product_categories')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });
    if (error) { console.warn(`product_categories(store_id=${storeId}):`, error.message); return; }
    if (data) setProductCategories(data);
  };

  const fetchSubcategories = async (categoryId: number) => {
    const { data, error } = await supabase
      .from('product_subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order');
    if (error) { console.warn('fetchSubcategories:', error.message); return; }
    setSubcategories(data || []);
  };

  const fetchSubItems = async (subcategoryId: number) => {
    const { data, error } = await supabase
      .from('subcategory_items')
      .select('*')
      .eq('subcategory_id', subcategoryId)
      .order('sort_order');
    if (error) { console.warn('fetchSubItems:', error.message); return; }
    setSubItems(data || []);
  };

  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !selectedCategoryForSub) return;
    setActionLoading(-10);
    try {
      const data = {
        store_id: store.id,
        category_id: selectedCategoryForSub.id,
        name: subcategoryForm.name,
        description: subcategoryForm.description,
        min_selections: parseInt(subcategoryForm.min_selections) || 0,
        max_selections: parseInt(subcategoryForm.max_selections) || 1,
        is_required: subcategoryForm.is_required,
      };
      if (editingSubcategory) {
        await supabase.from('product_subcategories').update(data).eq('id', editingSubcategory.id);
        showToast('Subcategoria atualizada!');
      } else {
        await supabase.from('product_subcategories').insert(data);
        showToast('Subcategoria criada!');
      }
      setShowSubcategoryModal(false);
      fetchSubcategories(selectedCategoryForSub.id);
    } catch (err) {
      showToast('Erro ao salvar subcategoria', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSubcategory = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Subcategoria',
      message: 'Isso vai excluir a subcategoria e todos os seus itens. Confirmar?',
      onConfirm: async () => {
        setConfirmModal(null);
        await supabase.from('product_subcategories').delete().eq('id', id);
        showToast('Subcategoria excluída');
        if (selectedCategoryForSub) fetchSubcategories(selectedCategoryForSub.id);
      }
    });
  };

  const handleSaveSubItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !selectedSubcategoryForItem) return;
    setActionLoading(-11);
    try {
      let imageUrl = subItemForm.image_url;
      if (subItemImageFile) {
        const ext = subItemImageFile.name.split('.').pop();
        const fileName = `subitem_${store.id}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('products').upload(fileName, subItemImageFile, { upsert: false });
        if (uploadErr) throw new Error('Erro ao fazer upload da imagem.');
        const { data: urlData } = supabase.storage.from('products').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
      const data = {
        subcategory_id: selectedSubcategoryForItem.id,
        store_id: store.id,
        name: subItemForm.name,
        description: subItemForm.description,
        price: parseFloat(subItemForm.price) || 0,
        image_url: imageUrl || null,
      };
      if (editingSubItem) {
        await supabase.from('subcategory_items').update(data).eq('id', editingSubItem.id);
        showToast('Item atualizado!');
      } else {
        await supabase.from('subcategory_items').insert(data);
        showToast('Item criado!');
      }
      setShowSubItemModal(false);
      fetchSubItems(selectedSubcategoryForItem.id);
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar item', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSubItem = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Item',
      message: 'Confirma a exclusão deste item?',
      onConfirm: async () => {
        setConfirmModal(null);
        await supabase.from('subcategory_items').delete().eq('id', id);
        showToast('Item excluído');
        if (selectedSubcategoryForItem) fetchSubItems(selectedSubcategoryForItem.id);
      }
    });
  };

  const fetchCoupons = async (storeId: number) => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) { console.warn(`coupons(store_id=${storeId}):`, error.message); return; }
    if (data) setCoupons(data);
  };

  const toggleStoreStatus = async (isOpen: boolean) => {
    if (!store) return;
    setLoading(true);
    try {
      await supabase.from('stores').update({ is_open: isOpen }).eq('id', store.id);
      setStore({ ...store, is_open: isOpen });
      showToast(isOpen ? 'Loja aberta!' : 'Loja fechada!', 'success');
    } catch (error) {
      showToast('Erro ao alterar status da loja', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (order: any) => {
    // Não para o som aqui — o useEffect cuida quando não houver mais pedidos pending
    await updateOrderStatus(order.id, 'preparing');
    printOrder(order);
  };

  const handleRejectOrder = async (orderId: number) => {
    // Não para o som aqui — o useEffect cuida quando não houver mais pedidos pending
    await updateOrderStatus(orderId, 'cancelled');
  };

  const printOrder = (order: any) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const items = order.order_items?.map((item: any) => {
      const selections = item.order_item_selections?.map((sel: any) =>
        `<tr><td style="padding:1px 0 1px 12px;font-size:11px;color:#666">↳ ${sel.item_name}${sel.item_price > 0 ? ` +R$ ${Number(sel.item_price).toFixed(2)}` : ''}</td><td></td></tr>`
      ).join('') || '';
      return `<tr>
        <td style="padding:2px 0">${item.quantity}x ${item.product_name}</td>
        <td style="text-align:right;padding:2px 0">R$ ${(item.unit_price * item.quantity).toFixed(2)}</td>
      </tr>${selections}`;
    }).join('') || '';

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            padding: 4mm;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .large { font-size: 16px; }
          .xlarge { font-size: 22px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .divider-solid { border-top: 2px solid #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; font-size: 12px; }
          .total-row td { font-size: 14px; font-weight: bold; padding-top: 4px; }
          .tag {
            display: inline-block;
            border: 1px solid #000;
            padding: 1px 6px;
            font-size: 11px;
            font-weight: bold;
          }
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <p class="large bold">${store?.name || 'Tá Na Mão'}</p>
          <p style="font-size:11px;margin-top:2px">${dateStr} às ${timeStr}</p>
        </div>

        <div class="divider-solid"></div>

        <div class="center">
          <p style="font-size:11px">PEDIDO</p>
          <p class="xlarge">#${order.id}</p>
        </div>

        <div class="divider"></div>

        <p class="bold">CLIENTE</p>
        <p>${order.users?.name || 'Cliente'}</p>

        ${order.addresses ? `
          <div style="margin-top:4px">
            <p class="bold">ENTREGAR EM</p>
            <p>${order.addresses.street}, ${order.addresses.number}${order.addresses.complement ? ' - ' + order.addresses.complement : ''}</p>
            <p>${order.addresses.neighborhood} - ${order.addresses.city}</p>
          </div>
        ` : ''}

        <div class="divider"></div>

        <p class="bold" style="margin-bottom:4px">ITENS</p>
        <table>${items}</table>

        ${order.subtotal !== order.total ? `
          <div class="divider"></div>
          <table>
            <tr><td>Subtotal</td><td style="text-align:right">R$ ${order.subtotal?.toFixed(2) || order.total.toFixed(2)}</td></tr>
            <tr><td>Taxa de entrega</td><td style="text-align:right">R$ ${order.delivery_fee?.toFixed(2) || '0.00'}</td></tr>
            ${order.discount_amount > 0 ? `<tr><td>Desconto</td><td style="text-align:right">- R$ ${order.discount_amount.toFixed(2)}</td></tr>` : ''}
          </table>
        ` : ''}

        <div class="divider-solid"></div>

        <table>
          <tr class="total-row">
            <td>TOTAL</td>
            <td style="text-align:right">R$ ${order.total.toFixed(2)}</td>
          </tr>
        </table>

        <div style="margin-top:6px">
          <span class="tag">${order.payment_method === 'cash' ? '💵 DINHEIRO' : order.payment_method === 'pix' ? '📱 PIX' : '💳 CARTÃO'}</span>
          ${order.payment_method === 'cash' && order.change_for ? `
            <p style="margin-top:3px;font-size:11px">Troco para: R$ ${order.change_for.toFixed(2)}</p>
          ` : ''}
        </div>

        ${order.client_notes ? `
          <div class="divider"></div>
          <p class="bold">⚠ OBSERVAÇÕES</p>
          <p style="font-size:12px">${order.client_notes}</p>
        ` : ''}

        <div class="divider"></div>
        <p class="center" style="font-size:10px">Tá Na Mão Delivery</p>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    setActionLoading(orderId);
    try {
      const updateData: any = { status };
      if (status === 'cancelled') updateData.cancelled_by = 'store';
      
      const { error: updateErr } = await supabase.from('orders').update(updateData).eq('id', orderId);
      if (updateErr) throw updateErr;

      // Busca client_id do pedido para notificar via FCM
      const { data: orderData } = await supabase
        .from('orders')
        .select('client_id')
        .eq('id', orderId)
        .single();

      if (orderData?.client_id) {
        const pushMessages: Record<string, { title: string; body: string }> = {
          accepted:   { title: '✅ Pedido Confirmado!', body: 'Sua loja confirmou o pedido e está preparando.' },
          preparing:  { title: '👨‍🍳 Pedido em Preparo!', body: 'Sua loja está preparando seu pedido.' },
          ready:      { title: '📦 Pedido Pronto!', body: 'Seu pedido está pronto e aguardando motoboy.' },
          delivering: { title: '🏍️ Pedido a Caminho!', body: 'Seu pedido saiu para entrega. Acompanhe no mapa!' },
          delivered:  { title: '🎉 Pedido Entregue!', body: 'Bom apetite! Não esqueça de avaliar a loja.' },
          cancelled:  { title: '❌ Pedido Cancelado', body: 'Seu pedido foi cancelado pela loja.' },
        };

        const msg = pushMessages[status];
        if (msg) {
          try {
            const { data: tokenData } = await supabase
              .from('push_tokens')
              .select('token')
              .eq('user_id', orderData.client_id);
            
            if (tokenData && tokenData.length > 0) {
              await supabase.functions.invoke('send-push', {
                body: {
                  title: msg.title,
                  body: msg.body,
                  targetType: 'specific_tokens',
                  tokens: tokenData.map((t: any) => t.token),
                }
              });
            }
          } catch (pushErr) {
            console.warn('Erro ao notificar cliente:', pushErr);
          }
        }
      }

      if (status === 'ready') {
        const courierFee = Math.max(Number(store?.delivery_fee) || 0, 2.00);

        // Cancela ofertas travadas do mesmo pedido (ex: loja clicou 2x)
        await supabase.from('deliveries')
          .update({ status: 'cancelled' })
          .eq('order_id', orderId)
          .eq('status', 'offered');

        const { error: deliveryErr } = await supabase.from('deliveries').insert({
          order_id: orderId,
          status: 'offered',
          courier_id: null,
          courier_earning: courierFee
        });
        
        if (deliveryErr) {
          console.error("Erro RLS ao despachar:", deliveryErr);
          showToast('Erro ao chamar motoboy. Verifique as permissões do sistema.', 'error');
          return;
        }

        // Notifica todos os motoboys via FCM
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              title: '🏍️ Nova Corrida Disponível!',
              body: `Ganho de R$ ${courierFee.toFixed(2)}. Aceite rápido!`,
              data: { type: 'delivery_offer', orderId },
              targetType: 'couriers',
            }
          });
        } catch (pushErr) {
          console.warn('Erro ao enviar push para motoboys:', pushErr);
        }
        
        showToast(`Procurando motoboys... (Ganho: R$ ${courierFee.toFixed(2)})`);
      } else {
        showToast('Status do pedido atualizado!');
      }

      // Atualiza billing em tempo real quando pedido é entregue
      if (status === 'delivered') {
        try {
          await supabase.functions.invoke('process-billing');
          // Recarrega ciclo do billing na tela
          const { data: cycle } = await supabase
            .from('billing_cycles')
            .select('*')
            .eq('store_id', store!.id)
            .order('period_start', { ascending: false })
            .limit(1)
            .maybeSingle();
          setStoreBillingCycle(cycle || null);
        } catch (e) {
          console.warn('Erro ao atualizar billing:', e);
        }
      }

      fetchOrders(store!.id);
      setLastUpdate(Date.now());
    } catch (error: any) {
      showToast("Erro ao atualizar pedido.", 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOwnDelivery = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'delivering',
          own_delivery: true
        })
        .eq('id', orderId);

      if (error) throw error;

      showToast('Entrega própria iniciada. Confirme quando entregar.');
      fetchOrders(store!.id);
      setLastUpdate(Date.now());
    } catch (error) {
      showToast('Erro ao iniciar entrega própria.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmOwnDelivery = async (orderId: number) => {
    setActionLoading(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      showToast('Entrega confirmada!', 'success');

      // Atualiza billing em tempo real
      try {
        await supabase.functions.invoke('process-billing');
        const { data: cycle } = await supabase
          .from('billing_cycles')
          .select('*')
          .eq('store_id', store!.id)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle();
        setStoreBillingCycle(cycle || null);
      } catch (e) {
        console.warn('Erro ao atualizar billing:', e);
      }

      fetchOrders(store!.id);
      setLastUpdate(Date.now());
    } catch (error) {
      showToast('Erro ao confirmar entrega.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendStoreMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatOrderId || !user) return;
    const msg = chatInput.trim(); setChatInput('');
    try {
      const { data, error } = await supabase.from('order_chats').insert({
        order_id: activeChatOrderId, sender_id: user.id, message: msg, is_system_message: false
      }).select().single();
      if (error) throw error;
      if (data) setOrders(prev => {
        const idx = prev.findIndex(o => o.id === activeChatOrderId);
        if (idx === -1) return prev;
        const updated = [...prev]; const order = { ...updated[idx] };
        if (!order.order_chats?.find((m: any) => m.id === data.id))
          order.order_chats = [...(order.order_chats || []), data];
        updated[idx] = order; return updated;
      });
    } catch { showToast('Erro ao enviar mensagem', 'error'); }
  };

  // --- CATEGORY ACTIONS ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setActionLoading(-3);
    try {
      const categoryData = {
        store_id: store.id,
        name: categoryForm.name,
        sort_order: parseInt(categoryForm.sort_order) || 0,
        is_active: categoryForm.is_active
      };

      if (editingCategory) {
        await supabase.from('product_categories').update(categoryData).eq('id', editingCategory.id);
        showToast('Categoria atualizada!');
      } else {
        await supabase.from('product_categories').insert(categoryData);
        showToast('Categoria criada!');
      }
      setShowCategoryModal(false);
      fetchProductCategories(store.id);
    } catch (error) {
      showToast('Erro ao salvar categoria', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCategory = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Tem certeza que deseja excluir esta categoria? Os produtos associados a ela ficarão sem categoria.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await supabase.from('products').update({ category_id: null }).eq('category_id', id);
          await supabase.from('product_categories').delete().eq('id', id);
          showToast('Categoria excluída');
          fetchProductCategories(store!.id);
          fetchProducts(store!.id);
        } catch (error) {
          showToast('Erro ao excluir categoria', 'error');
        }
      }
    });
  };

  const toggleCategoryStatus = async (category: any) => {
    try {
      await supabase.from('product_categories').update({ is_active: !category.is_active }).eq('id', category.id);
      fetchProductCategories(store!.id);
    } catch (error) {
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const openNewCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', sort_order: '0', is_active: true });
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: any) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name, sort_order: category.sort_order.toString(), is_active: category.is_active });
    setShowCategoryModal(true);
  };

  // --- PRODUCT ACTIONS ---
  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) { 
        showToast('A imagem deve ter no máximo 10MB', 'warning');
        return;
      }
      setProductImageFile(file);
      const readerProduct = new FileReader();
      readerProduct.onload = (ev) => { if (ev.target?.result) setProductImagePreview(ev.target.result as string); };
      readerProduct.onerror = () => setProductImagePreview(null);
      readerProduct.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setActionLoading(-1); 
    
    try {
      let finalImageUrl = productForm.image_url;

      if (productImageFile) {
        const fileExt = productImageFile.name.split('.').pop();
        const fileName = `product_${store.id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(fileName, productImageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error('Erro ao fazer upload da imagem.');
        }

        const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
      }

      const productData = {
        store_id: store.id,
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        image_url: finalImageUrl || null,
        is_available: productForm.is_available,
        category_id: productForm.category_id ? parseInt(productForm.category_id) : null
      };

      if (editingProduct) {
        await supabase.from('products').update(productData).eq('id', editingProduct.id);
        showToast('Produto atualizado!');
      } else {
        await supabase.from('products').insert(productData);
        showToast('Produto criado!');
      }
      
      setShowProductModal(false);
      fetchProducts(store.id);
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar produto', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteProduct = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await supabase.from('products').delete().eq('id', id);
          showToast('Produto excluído');
          fetchProducts(store!.id);
        } catch (error) {
          showToast('Erro ao excluir produto', 'error');
        }
      }
    });
  };

  const toggleProductAvailability = async (product: Product) => {
    try {
      await supabase.from('products').update({ is_available: !product.is_available }).eq('id', product.id);
      fetchProducts(store!.id);
    } catch (error) {
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: '', image_url: '', is_available: true, category_id: '' });
    setProductImageFile(null);
    setProductImagePreview(null);
    setShowProductModal(true);
  };

  const openEditProductModal = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      image_url: product.image_url || '',
      is_available: product.is_available,
      category_id: product.category_id?.toString() || ''
    });
    setProductImageFile(null);
    setProductImagePreview(product.image_url || null);
    setShowProductModal(true);
  };

  // --- COUPON ACTIONS ---
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !user) return;
    setActionLoading(-2);

    try {
      const couponData = {
        store_id: store.id,
        created_by: user.id,
        code: couponForm.code.toUpperCase().replace(/\s+/g, ''),
        type: couponForm.type,
        value: parseFloat(couponForm.value),
        min_order_value: parseFloat(couponForm.min_order_value || '0'),
        expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
        is_active: couponForm.is_active,
        max_uses_per_user: 1
      };

      const { error } = await supabase.from('coupons').insert(couponData);
      if (error) {
        if (error.message.includes('duplicate key')) throw new Error('Este código de cupom já existe.');
        throw error;
      }

      const createdCode = couponData.code;
      setNewCouponCode(createdCode);
      setShowCouponModal(false);
      fetchCoupons(store.id);
      setShowNotifyModal(true);
    } catch (error: any) {
      showToast(error.message || 'Erro ao criar cupom', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
      fetchCoupons(store!.id);
      showToast(coupon.is_active ? 'Cupom desativado' : 'Cupom ativado');
    } catch (error) {
      showToast('Erro ao atualizar cupom', 'error');
    }
  };

  const handleDeleteCoupon = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Cupom',
      message: 'Tem certeza que deseja excluir este cupom? Clientes não poderão mais utilizá-lo.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await supabase.from('coupons').delete().eq('id', id);
          showToast('Cupom excluído');
          fetchCoupons(store!.id);
        } catch (error) {
          showToast('Erro ao excluir cupom', 'error');
        }
      }
    });
  };

  // --- SETTINGS ACTIONS ---
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
    setSettingsForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        showToast('A imagem deve ter no máximo 5MB', 'warning');
        return;
      }
      setLogoFile(file);
      const readerLogo = new FileReader();
      readerLogo.onload = (ev) => { if (ev.target?.result) setLogoPreview(ev.target.result as string); };
      readerLogo.onerror = () => setLogoPreview(null);
      readerLogo.readAsDataURL(file);
    }
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) { 
        showToast('A imagem do banner deve ter no máximo 10MB', 'warning');
        return;
      }
      setBannerFile(file);
      const readerBanner = new FileReader();
      readerBanner.onload = (ev) => { if (ev.target?.result) setBannerPreview(ev.target.result as string); };
      readerBanner.onerror = () => setBannerPreview(null);
      readerBanner.readAsDataURL(file);
    }
  };

  const handleUpdateStoreSettings = async (
    e: React.FormEvent,
    section: 'profile' | 'delivery' | 'payment' = 'profile'
  ) => {
    e.preventDefault();
    if (!store || !user) return;
    setSettingsLoading(true);

    try {
      const storeUpdateData: any = {};

      if (section === 'profile') {
        let updatedLogoUrl = settingsForm.logo_url;
        let updatedBannerUrl = settingsForm.banner_url;

        if (logoFile) {
          const fileExt = logoFile.name.split('.').pop();
          const fileName = `store_logo_${store.id}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(fileName, logoFile, { cacheControl: '3600', upsert: true });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            throw new Error('Erro ao fazer upload do logo.');
          }

          const { data: publicUrlData } = supabase.storage.from('stores').getPublicUrl(fileName);
          updatedLogoUrl = publicUrlData.publicUrl;
        }

        if (bannerFile) {
          const fileExt = bannerFile.name.split('.').pop();
          const fileName = `store_banner_${store.id}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('stores')
            .upload(fileName, bannerFile, { cacheControl: '3600', upsert: true });

          if (uploadError) {
            console.error("Upload banner error:", uploadError);
            throw new Error('Erro ao fazer upload do banner.');
          }

          const { data: publicUrlData } = supabase.storage.from('stores').getPublicUrl(fileName);
          updatedBannerUrl = publicUrlData.publicUrl;
        }

        storeUpdateData.name = settingsForm.name;
        storeUpdateData.phone = settingsForm.phone;
        storeUpdateData.logo_url = updatedLogoUrl;
        storeUpdateData.banner_url = updatedBannerUrl;
      }

      if (section === 'delivery') {
        storeUpdateData.delivery_fee = parseFloat(settingsForm.delivery_fee);
        storeUpdateData.min_order_value = parseFloat(settingsForm.min_order_value);
        storeUpdateData.avg_prep_time_min = parseInt(settingsForm.avg_prep_time_min, 10);
      }

      if (section === 'payment') {
        storeUpdateData.accepts_pix = settingsForm.accepts_pix;
        storeUpdateData.accepts_card = settingsForm.accepts_card;
        storeUpdateData.accepts_cash = settingsForm.accepts_cash;
      }

      const { error: storeError } = await supabase
        .from('stores')
        .update(storeUpdateData)
        .eq('id', store.id);

      if (storeError) throw storeError;

      if (section === 'profile') {
        const { error: userPhoneError } = await supabase
          .from('users')
          .update({ phone: settingsForm.phone })
          .eq('id', user.id);

        if (userPhoneError) console.warn("Could not update user's phone:", userPhoneError.message);
      }

      setStore(prev => prev ? { ...prev, ...storeUpdateData } : null);
      if (section === 'profile') {
        setLogoFile(null);
        setBannerFile(null);
      }
      showToast('Configurações da loja atualizadas!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar configurações da loja.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (settingsForm.newPassword !== settingsForm.confirmPassword) {
      showToast('As senhas não coincidem.', 'warning');
      return;
    }
    if (settingsForm.newPassword.length < 6) {
      showToast('A senha deve ter no mínimo 6 caracteres.', 'warning');
      return;
    }

    setSettingsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: settingsForm.newPassword
      });

      if (error) throw error;

      showToast('Senha atualizada com sucesso!', 'success');
      setSettingsForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar senha.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };


  const formatTime = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
  };

  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'orders', icon: <ShoppingBag size={20} />, label: 'Pedidos Ativos' },
    { id: 'chats', icon: <MessageSquare size={20} />, label: 'Chats' },
    { id: 'history', icon: <History size={20} />, label: 'Histórico' },
    { id: 'categories', icon: <FolderTree size={20} />, label: 'Categorias' },
    { id: 'products', icon: <Package size={20} />, label: 'Cardápio' },
    { id: 'coupons', icon: <Ticket size={20} />, label: 'Cupons' },
    { id: 'reviews', icon: <Star size={20} />, label: 'Avaliações' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Configurações' },
  ];

  if (loading && !store) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-brand-primary mb-4" size={48} />
        <p className="text-gray-500 font-medium">Carregando painel da loja...</p>
      </div>
    );
  }

  if (!loading && !store) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-red-500 font-bold mb-4">Loja não encontrada ou não aprovada.</p>
        <button onClick={onExit} className="px-6 py-2 bg-gray-200 rounded-xl font-bold">Sair do Painel</button>
      </div>
    );
  }

  if (!store) return null;

  return (
    <div className="flex h-screen bg-gray-50 w-full font-sans" style={{paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)'}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* OVERLAY MOBILE */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col shadow-2xl md:shadow-sm transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-brand-dark flex items-center"><span className="text-brand-primary mr-2">Tá Na Mão</span></h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">Portal do Parceiro</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {menuItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all relative ${activeTab === item.id ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-gray-600 hover:bg-brand-light hover:text-brand-primary'}`}
            >
              {item.icon}<span>{item.label}</span>
              {item.id === 'chats' && orders.some(o => o.order_chats?.length > 0) && (
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse absolute top-3 right-4"></span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={onExit} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 font-medium transition-colors">
            <LogOut size={20} /><span>Sair do Painel</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {loading && <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary animate-pulse z-50"></div>}
        
        <header className="bg-white border-b border-gray-200 h-20 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center space-x-3 md:space-x-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu size={24} />
            </button>
            <div className="w-10 h-10 bg-brand-light text-brand-primary rounded-lg flex items-center justify-center font-bold text-xl shrink-0">{store.name.charAt(0)}</div>
            <div className="hidden sm:block">
              <h2 className="font-bold text-brand-dark leading-tight truncate max-w-[150px] md:max-w-xs">{store.name}</h2>
              <p className="text-xs text-gray-500">{store.is_approved ? 'Verificada' : 'Pendente'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-gray-50 p-1.5 rounded-full border border-gray-200">
              <button onClick={() => toggleStoreStatus(false)} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${!store.is_open ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}>Fechada</button>
              <button onClick={() => toggleStoreStatus(true)} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${store.is_open ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-400'}`}>Aberta</button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {/* BANNER DE NOTIFICAÇÕES */}
          {notifPermission === 'default' && (
            <div className="max-w-6xl mx-auto mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-4 shrink-0">
                  <BellRing size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-blue-900">Ative as Notificações</h3>
                  <p className="text-sm text-blue-700 hidden sm:block">Seja avisado imediatamente quando um novo pedido chegar.</p>
                </div>
              </div>
              <button onClick={requestPermission} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm shrink-0 ml-2">
                Ativar
              </button>
            </div>
          )}

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl md:text-3xl font-black text-brand-dark">Olá, Parceiro! 👋</h2>
                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                  <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full overflow-x-auto scrollbar-hide">
                    <button onClick={() => setDashboardFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === 'today' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Hoje</button>
                    <button onClick={() => setDashboardFilter('7days')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === '7days' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>7 dias</button>
                    <button onClick={() => setDashboardFilter('15days')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === '15days' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>15 dias</button>
                    <button onClick={() => setDashboardFilter('30days')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === '30days' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>30 dias</button>
                    <button onClick={() => setDashboardFilter('custom')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === 'custom' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Personalizado</button>
                  </div>
                  {dashboardFilter === 'custom' && (
                    <div className="flex gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto justify-between">
                      <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="text-sm border-none outline-none text-gray-700 bg-transparent w-full md:w-auto" />
                      <span className="text-gray-400 text-sm font-medium">até</span>
                      <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="text-sm border-none outline-none text-gray-700 bg-transparent w-full md:w-auto" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-500 w-fit mb-4"><ShoppingBag size={24} /></div>
                  <h3 className="text-2xl md:text-3xl font-black text-brand-dark">{dashboardMetrics.totalOrders}</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Pedidos no período</p>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-3 bg-green-50 rounded-xl text-green-500 w-fit mb-4"><Check size={24} /></div>
                  <h3 className="text-2xl md:text-3xl font-black text-brand-dark">{dashboardMetrics.deliveredOrders}</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Entregues no período</p>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-3 bg-red-50 rounded-xl text-red-500 w-fit mb-4"><X size={24} /></div>
                  <h3 className="text-2xl md:text-3xl font-black text-brand-dark">{dashboardMetrics.cancelledOrders}</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Cancelados no período</p>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-3 bg-brand-light rounded-xl text-brand-primary w-fit mb-4"><DollarSign size={24} /></div>
                  <h3 className="text-2xl md:text-3xl font-black text-brand-dark">R$ {dashboardMetrics.revenue.toFixed(2)}</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Faturamento no período</p>
                </div>
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 col-span-2 md:col-span-1 lg:col-span-1">
                  <div className="p-3 bg-yellow-50 rounded-xl text-yellow-500 w-fit mb-4"><Star size={24} /></div>
                  <h3 className="text-2xl md:text-3xl font-black text-brand-dark">{store.avg_rating > 0 ? store.avg_rating.toFixed(1) : '—'}</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Avaliação geral</p>
                </div>
                {/* Card Financeiro da Plataforma */}
                <div className="col-span-2 md:col-span-3 lg:col-span-5 bg-gradient-to-r from-brand-primary to-green-600 p-6 rounded-2xl shadow-md text-white">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <DollarSign size={20} className="text-white" />
                      </div>
                      <p className="font-bold text-white/80 text-sm uppercase tracking-wider">Sua conta com a plataforma</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white/20 rounded-xl p-3">
                        <p className="text-white/70 text-xs mb-1">Pedidos no ciclo</p>
                        <p className="text-white font-black text-lg">R$ {Number(storeBillingCycle?.total_orders_amount || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white/20 rounded-xl p-3">
                        <p className="text-white/70 text-xs mb-1">Comissão 4%</p>
                        <p className="text-white font-black text-lg">R$ {Number(storeBillingCycle?.platform_commission || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white/20 rounded-xl p-3">
                        <p className="text-white/70 text-xs mb-1">Taxa motoboys</p>
                        <p className="text-white font-black text-lg">R$ {Number(storeBillingCycle?.delivery_fees_amount || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white/30 rounded-xl p-3 border-2 border-white/40">
                        <p className="text-white/70 text-xs mb-1">Total a pagar</p>
                        <p className="text-white font-black text-xl">R$ {Number(storeBillingCycle?.total_due || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded-xl p-3">
                      <p className="text-white/80 text-xs">
                        {storeBillingCycle ? (
                          <>Ciclo: {new Date(storeBillingCycle.period_start).toLocaleDateString('pt-BR')} até {new Date(storeBillingCycle.period_end).toLocaleDateString('pt-BR')}</>
                        ) : 'Nenhum ciclo ativo ainda'}
                      </p>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        storeBillingCycle?.status === 'paid' ? 'bg-green-400/30 text-white' :
                        storeBillingCycle?.status === 'charged' ? 'bg-yellow-400/30 text-white' :
                        storeBillingCycle?.status === 'overdue' ? 'bg-red-400/30 text-white' :
                        'bg-white/20 text-white'
                      }`}>
                        {storeBillingCycle?.status === 'paid' ? '✓ Pago' :
                         storeBillingCycle?.status === 'charged' ? '⚠️ Aguardando pagamento' :
                         storeBillingCycle?.status === 'overdue' ? '🔴 Inadimplente' :
                         '🔄 Em aberto'}
                      </span>
                    </div>
                    {storeBillingCycle?.due_date && storeBillingCycle?.status === 'charged' && (
                      <p className="text-white/80 text-xs text-center bg-yellow-400/20 rounded-lg py-2">
                        ⏰ Prazo para pagamento: {new Date(storeBillingCycle.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KANBAN PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="max-w-7xl mx-auto h-full flex flex-col min-h-0">
              <h2 className="text-2xl font-bold text-brand-dark mb-6">Gestor de Pedidos</h2>
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto md:overflow-hidden pb-10 md:pb-0">
                
                {/* Novos */}
                <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-[600px] md:h-full">
                  <h3 className="font-bold text-gray-700 mb-4 flex justify-between items-center">
                    Novos <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{orders.filter(o => o.status === 'pending').length}</span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {orders.filter(o => o.status === 'pending').length === 0 && <p className="text-center text-gray-400 text-sm mt-10">Nenhum pedido novo</p>}
                    {orders.filter(o => o.status === 'pending').map(order => (
                      <div key={order.id} className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border-l-4 border-l-brand-secondary relative">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-xs font-bold text-gray-400">#{order.id}</span>
                            <h4 className="font-bold text-brand-dark mt-1">{order.users?.name || 'Cliente'}</h4>
                            {order.users?.phone && (
                              <a
                                href={`https://wa.me/55${order.users.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-green-600 font-bold mt-1 hover:underline"
                              >
                                📞 {order.users.phone}
                              </a>
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg flex items-center"><Clock size={12} className="mr-1"/>{formatTime(order.created_at)}</span>
                        </div>
                        
                        {order.addresses && (
                          <p className="text-xs text-gray-500 mb-3 flex items-start">
                            <MapPin size={12} className="mr-1 shrink-0 mt-0.5"/>
                            {order.addresses.street}, {order.addresses.number} - {order.addresses.neighborhood}
                          </p>
                        )}

                        {order.client_notes && (
                          <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded-lg mb-3 flex items-start border border-yellow-200">
                            <span className="mr-1">📝</span> <span className="font-medium">{order.client_notes}</span>
                          </div>
                        )}

                        <div className="text-sm text-gray-600 mb-3 space-y-1">
                          {order.order_items?.map((item:any) => (
                            <div key={item.id}>
                              <p className="font-medium">{item.quantity}x {item.product_name}</p>
                              {item.order_item_selections?.map((sel:any) => (
                                <p key={sel.id} className="text-xs text-gray-400 pl-3">↳ {sel.item_name}{sel.item_price > 0 ? ` +R$ ${Number(sel.item_price).toFixed(2)}` : ''}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mb-4">
                          <div className="font-black text-brand-dark text-lg">R$ {order.total.toFixed(2)}</div>
                          {order.payment_method === 'cash' ? (
                            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200">💵 DINHEIRO</span>
                          ) : order.payment_method === 'pix' ? (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200">📱 PIX</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-200">💳 CARTÃO</span>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleAcceptOrder(order)} 
                            disabled={actionLoading === order.id} 
                            className="flex-1 bg-brand-primary text-white py-2.5 rounded-xl text-sm font-bold flex justify-center items-center"
                          >
                            {actionLoading === order.id ? <Loader2 size={16} className="animate-spin"/> : 'Aceitar e Preparar'}
                          </button>
                          <button onClick={() => handleRejectOrder(order.id)} disabled={actionLoading === order.id} className="px-4 bg-gray-100 text-gray-500 py-2.5 rounded-xl text-sm font-bold">Recusar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Em Preparo */}
                <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-[600px] md:h-full">
                  <h3 className="font-bold text-gray-700 mb-4 flex justify-between items-center">
                    Em Preparo <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{orders.filter(o => o.status === 'preparing').length}</span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {orders.filter(o => o.status === 'preparing').length === 0 && <p className="text-center text-gray-400 text-sm mt-10">Nenhum pedido em preparo</p>}
                    {orders.filter(o => o.status === 'preparing').map(order => (
                      <div key={order.id} className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border-l-4 border-l-blue-500 relative">
                        <button
                          onClick={() => printOrder(order)}
                          title="Reimprimir comanda"
                          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Printer size={14} />
                        </button>
                        <div className="flex justify-between items-start mb-2 pr-6">
                          <div>
                            <span className="text-xs font-bold text-gray-400">#{order.id}</span>
                            <h4 className="font-bold text-brand-dark mt-1">{order.users?.name || 'Cliente'}</h4>
                            {order.users?.phone && (
                              <a
                                href={`https://wa.me/55${order.users.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-green-600 font-bold mt-1 hover:underline"
                              >
                                📞 {order.users.phone}
                              </a>
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg flex items-center"><Clock size={12} className="mr-1"/>{formatTime(order.created_at)}</span>
                        </div>

                        {order.addresses && (
                          <p className="text-xs text-gray-500 mb-3 flex items-start">
                            <MapPin size={12} className="mr-1 shrink-0 mt-0.5"/>
                            {order.addresses.street}, {order.addresses.number} - {order.addresses.neighborhood}
                          </p>
                        )}

                        {order.client_notes && (
                          <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded-lg mb-3 flex items-start border border-yellow-200">
                            <span className="mr-1">📝</span> <span className="font-medium">{order.client_notes}</span>
                          </div>
                        )}

                        <div className="text-sm text-gray-600 mb-4 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          {order.order_items?.map((item:any) => (
                            <div key={item.id}>
                              <p className="font-medium">{item.quantity}x {item.product_name}</p>
                              {item.order_item_selections?.map((sel:any) => (
                                <p key={sel.id} className="text-xs text-gray-400 pl-3">↳ {sel.item_name}{sel.item_price > 0 ? ` +R$ ${Number(sel.item_price).toFixed(2)}` : ''}</p>
                              ))}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 mt-3">
                          <button
                            onClick={() => updateOrderStatus(order.id, 'ready')}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-blue-50 text-blue-600 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center hover:bg-blue-100 transition-colors"
                          >
                            {actionLoading === order.id ? <Loader2 size={16} className="animate-spin"/> : <><Bike size={14} className="mr-1.5"/>Chamar Motoboy</>}
                          </button>
                          <button
                            onClick={() => handleOwnDelivery(order.id)}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-purple-50 text-purple-600 py-2.5 rounded-xl text-sm font-bold flex justify-center items-center hover:bg-purple-100 transition-colors"
                          >
                            {actionLoading === order.id ? <Loader2 size={16} className="animate-spin"/> : <><User size={14} className="mr-1.5"/>Entrega Própria</>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prontos */}
                <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-[600px] md:h-full">
                  <h3 className="font-bold text-gray-700 mb-4 flex justify-between items-center">
                    Prontos / Rota <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{orders.filter(o => o.status === 'ready' || o.status === 'delivering').length}</span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {orders.filter(o => o.status === 'ready' || o.status === 'delivering').length === 0 && <p className="text-center text-gray-400 text-sm mt-10">Nenhum pedido aguardando entrega</p>}
                    {orders.filter(o => o.status === 'ready' || o.status === 'delivering').map(order => (
                      <div key={order.id} className={`bg-white rounded-2xl p-4 md:p-5 shadow-sm border-l-4 ${order.own_delivery ? 'border-l-purple-500' : order.courier_id ? 'border-l-brand-primary' : 'border-l-yellow-400'} opacity-90`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-gray-400">#{order.id}</span>
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg flex items-center"><Clock size={12} className="mr-1"/>{formatTime(order.created_at)}</span>
                        </div>
                        <h4 className="font-bold text-brand-dark mt-1">{order.users?.name || 'Cliente'}</h4>
                        {order.users?.phone && (
                          <a
                            href={`https://wa.me/55${order.users.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-green-600 font-bold mt-1 hover:underline"
                          >
                            📞 {order.users.phone}
                          </a>
                        )}
                        
                        {order.addresses && (
                          <p className="text-xs text-gray-500 mb-2 flex items-start mt-1">
                            <MapPin size={12} className="mr-1 shrink-0 mt-0.5"/>
                            {order.addresses.street}, {order.addresses.number} - {order.addresses.neighborhood}
                          </p>
                        )}
                        
                        {order.own_delivery ? (
                          <div className="mt-3 space-y-2">
                            <div className="bg-purple-50 text-purple-700 text-xs font-bold p-2 rounded-lg flex items-center border border-purple-200">
                              <User size={14} className="mr-1"/> Entrega Própria
                            </div>
                            {order.status === 'delivering' && (
                              <button
                                onClick={() => handleConfirmOwnDelivery(order.id)}
                                disabled={actionLoading === order.id}
                                className="w-full bg-brand-primary text-white py-2.5 rounded-xl text-sm font-bold flex justify-center items-center hover:bg-green-600 transition-colors"
                              >
                                {actionLoading === order.id
                                  ? <Loader2 size={16} className="animate-spin"/>
                                  : <><CheckCircle size={14} className="mr-1.5"/>Confirmar Entrega</>
                                }
                              </button>
                            )}
                          </div>
                        ) : order.courier_id ? (
                          <div className="mt-3 bg-green-50 text-green-700 text-xs font-bold p-2 rounded-lg flex items-center">
                            <Bike size={14} className="mr-1"/> Com motoboy
                          </div>
                        ) : (
                          (() => {
                            const offer = order.deliveries?.find((d: any) => d.status === 'offered');
                            let timeLeft = 60;
                            if (offer) {
                              const elapsed = Math.floor((now - new Date(offer.created_at).getTime()) / 1000);
                              timeLeft = Math.max(0, Math.min(60, 60 - elapsed));
                            }
                            return (
                              <div className="mt-3 bg-yellow-50 text-yellow-700 text-xs font-bold p-2 rounded-lg flex items-center justify-between border border-yellow-200">
                                <div className="flex items-center">
                                  <Loader2 size={14} className="mr-1 animate-spin"/> Aguardando motoboy
                                </div>
                                {offer && <span className="font-mono bg-yellow-100 px-1.5 py-0.5 rounded text-[10px]">0:{timeLeft.toString().padStart(2, '0')}</span>}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CHATS */}
          {activeTab === 'chats' && (
            <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
              <h2 className="text-2xl font-black text-gray-800 mb-6 shrink-0">Chat com Clientes</h2>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
                <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-y-auto ${activeChatOrderId ? 'hidden md:block' : 'block'}`}>
                  {orders.length === 0 && <p className="p-8 text-center text-gray-500 text-sm">Nenhum pedido ativo.</p>}
                  {orders.map(order => {
                    const msgs = order.order_chats || [];
                    const last = msgs[msgs.length - 1];
                    return (
                      <button key={order.id} onClick={() => setActiveChatOrderId(order.id)}
                        className={`w-full p-4 border-b border-gray-100 text-left hover:bg-gray-50 ${activeChatOrderId === order.id ? 'bg-brand-light border-l-4 border-l-brand-primary' : 'border-l-4 border-l-transparent'}`}>
                        <div className="flex justify-between mb-1">
                          <span className="font-bold text-gray-800">Pedido #{order.id}</span>
                          <span className="text-xs text-gray-500">{order.users?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <p className={`text-xs truncate max-w-[80%] ${last?.is_system_message ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                            {last ? last.message : 'Sem mensagens'}
                          </p>
                          {msgs.length > 0 && <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{msgs.length}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className={`md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden ${!activeChatOrderId ? 'hidden md:flex' : 'flex h-[600px] md:h-auto'}`}>
                  {!activeChatOrderId ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                      <MessageSquare size={48} className="mb-4 opacity-30" />
                      <p className="text-sm">Selecione um pedido para ver o chat.</p>
                    </div>
                  ) : (() => {
                    const order = orders.find(o => o.id === activeChatOrderId);
                    if (!order) return null;
                    const msgs = (order.order_chats || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    return (
                      <>
                        <div className="p-4 border-b bg-gray-50 shrink-0 flex justify-between items-center">
                          <div className="flex items-center">
                            <button onClick={() => setActiveChatOrderId(null)} className="md:hidden p-2 -ml-2 mr-2 text-gray-600 hover:bg-gray-200 rounded-lg">
                              <ChevronLeft size={24} />
                            </button>
                            <div>
                              <h3 className="font-bold text-gray-800">Pedido #{order.id}</h3>
                              <p className="text-xs text-gray-500">Cliente: {order.users?.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold border border-gray-200 text-gray-600 hidden sm:inline-block">
                              {order.status === 'pending' ? 'Novo' : order.status === 'preparing' ? 'Em Preparo' : 'Pronto/Rota'}
                            </span>
                            {['pending', 'preparing', 'ready', 'delivering'].includes(order.status) && (
                              <button 
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Cancelar Pedido',
                                    message: 'Tem certeza que deseja cancelar este pedido? O cliente será notificado.',
                                    onConfirm: async () => {
                                      await handleRejectOrder(order.id);
                                      setActiveChatOrderId(null);
                                      setConfirmModal(null);
                                    }
                                  });
                                }}
                                className="bg-red-500 text-white px-3 md:px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 transition-colors flex items-center shadow-sm"
                              >
                                <XCircle size={14} className="mr-1.5" /> <span className="hidden sm:inline">Cancelar Pedido</span><span className="sm:hidden">Cancelar</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {msgs.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400"><MessageSquare size={48} className="mb-4 opacity-50" /><p className="text-sm">Sem mensagens.</p></div>}
                          {msgs.map((msg: any) => {
                            if (msg.is_system_message) return (
                              <div key={msg.id} className="flex justify-center">
                                <span className="bg-red-100 text-red-800 text-xs font-bold px-4 py-2 rounded-xl border border-red-200 text-center max-w-[85%]">{msg.message}</span>
                              </div>
                            );
                            const isStore = msg.sender_id === user?.id;
                            return (
                              <div key={msg.id} className={`flex flex-col ${isStore ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] p-3 text-sm ${isStore ? 'bg-brand-primary text-white rounded-2xl rounded-tr-sm' : 'bg-green-100 text-green-900 border border-green-200 rounded-2xl rounded-tl-sm'}`}>{msg.message}</div>
                                <span className="text-[10px] text-gray-400 mt-1">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 bg-white border-t shrink-0">
                          <form onSubmit={handleSendStoreMessage} className="flex items-center gap-2">
                            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Digite sua mensagem..."
                              className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm outline-none" />
                            <button type="submit" disabled={!chatInput.trim()}
                              className="w-12 h-12 bg-brand-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 shrink-0">
                              <Send size={18} className="ml-1" />
                            </button>
                          </form>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* HISTÓRICO DE PEDIDOS */}
          {activeTab === 'history' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">Histórico de Pedidos</h2>
                <div className="flex bg-gray-200 p-1 rounded-xl w-full md:w-auto overflow-x-auto scrollbar-hide">
                  <button onClick={() => setHistoryFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${historyFilter === 'today' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Hoje</button>
                  <button onClick={() => setHistoryFilter('yesterday')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${historyFilter === 'yesterday' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Ontem</button>
                  <button onClick={() => setHistoryFilter('week')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${historyFilter === 'week' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Últimos 7 dias</button>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">#ID</th>
                      <th className="p-4 font-medium">Cliente</th>
                      <th className="p-4 font-medium">Itens</th>
                      <th className="p-4 font-medium">Total</th>
                      <th className="p-4 font-medium">Pagamento</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyOrders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-400">#{order.id}</td>
                        <td className="p-4 font-bold text-brand-dark">{order.users?.name || 'Cliente'}</td>
                        <td className="p-4 text-sm text-gray-600 max-w-[200px]">
                          <div className="space-y-0.5">
                            {order.order_items?.map((item:any) => (
                              <div key={item.id}>
                                <span>{item.quantity}x {item.product_name}</span>
                                {item.order_item_selections?.length > 0 && (
                                  <span className="text-xs text-gray-400"> ({item.order_item_selections.map((s:any) => s.item_name).join(', ')})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-brand-dark">R$ {order.total.toFixed(2)}</td>
                        <td className="p-4">
                          {order.payment_method === 'cash' ? (
                            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">💵 DINHEIRO</span>
                          ) : order.payment_method === 'pix' ? (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">📱 PIX</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded">💳 CARTÃO</span>
                          )}
                        </td>
                        <td className="p-4">
                          {order.status === 'delivered' ? (
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded flex items-center w-fit"><Check size={12} className="mr-1"/> Entregue</span>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded flex items-center w-fit"><X size={12} className="mr-1"/> Cancelado</span>
                              {order.status === 'cancelled' && order.cancel_reason && (
                                <span className="text-[10px] text-red-400 mt-1">"{order.cancel_reason}"</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('pt-BR')} às {formatTime(order.created_at)}
                        </td>
                      </tr>
                    ))}
                    {historyOrders.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-500">
                          Nenhum pedido no período selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {historyHasMore && historyOrders.length > 0 && (
                  <div className="flex justify-center my-6">
                    <button
                      onClick={() => {
                        const nextPage = historyPage + 1;
                        setHistoryPage(nextPage);
                        fetchHistoryOrders(nextPage, true);
                      }}
                      disabled={loading}
                      className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                      Carregar mais pedidos
                    </button>
                  </div>
                )}
                {!historyHasMore && historyOrders.length > 0 && (
                  <p className="text-center text-gray-400 text-sm mt-6 pb-4">Todos os pedidos foram carregados.</p>
                )}
              </div>
            </div>
          )}

          {/* CATEGORIAS DO CARDÁPIO */}
          {activeTab === 'categories' && !showSubcategoryPanel && (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">Categorias do Cardápio</h2>
                <button onClick={openNewCategoryModal} className="bg-brand-primary text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold flex items-center shadow-md hover:bg-green-600 transition-colors text-sm md:text-base">
                  <Plus size={20} className="mr-1 md:mr-2" /> <span className="hidden sm:inline">Nova Categoria</span><span className="sm:hidden">Nova</span>
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">Nome da Categoria</th>
                      <th className="p-4 font-medium">Ordem</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productCategories.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-brand-dark">{c.name}</td>
                        <td className="p-4 text-gray-600">{c.sort_order}</td>
                        <td className="p-4">
                          <button onClick={() => toggleCategoryStatus(c)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${c.is_active ? 'bg-brand-light text-brand-primary hover:bg-green-100' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                            {c.is_active ? 'Ativa' : 'Inativa'}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedCategoryForSub(c);
                              setShowSubcategoryPanel(true);
                              fetchSubcategories(c.id);
                            }}
                            className="p-2 text-gray-400 hover:text-purple-500 transition-colors"
                            title="Gerenciar Subcategorias/Adicionais"
                          ><Plus size={18}/></button>
                          <button onClick={() => openEditCategoryModal(c)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={18}/></button>
                          <button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                    {productCategories.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-gray-500">
                          <div className="flex flex-col items-center justify-center">
                            <FolderTree size={48} className="text-gray-300 mb-4" />
                            <p className="font-medium">Nenhuma categoria criada ainda.</p>
                            <p className="text-sm mt-1">Crie categorias (ex: Lanches, Bebidas) para organizar seu cardápio.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBCATEGORIAS PANEL */}
          {activeTab === 'categories' && showSubcategoryPanel && selectedCategoryForSub && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => { setShowSubcategoryPanel(false); setSubcategories([]); setSubItems([]); setSelectedSubcategoryForItem(null); }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-brand-dark">Subcategorias / Adicionais</h2>
                  <p className="text-sm text-gray-500">Categoria: <span className="font-bold text-brand-primary">{selectedCategoryForSub.name}</span></p>
                </div>
                <button
                  onClick={() => {
                    setEditingSubcategory(null);
                    setSubcategoryForm({ name: '', description: '', min_selections: '0', max_selections: '5', is_required: false });
                    setShowSubcategoryModal(true);
                  }}
                  className="ml-auto bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-green-600 transition-colors text-sm"
                >
                  <Plus size={18} className="mr-1" /> Nova Subcategoria
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
                💡 Subcategorias aparecem como grupos de opções quando o cliente escolhe um produto desta categoria. Ex: "Adicionais", "Tamanho", "Complementos".
              </p>

              {subcategories.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                  <Plus size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="font-medium">Nenhuma subcategoria criada.</p>
                  <p className="text-sm mt-1">Crie grupos de opções extras para os produtos desta categoria.</p>
                </div>
              )}

              <div className="space-y-4">
                {subcategories.map(sub => (
                  <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="p-4 flex items-center justify-between border-b border-gray-100">
                      <div>
                        <h3 className="font-bold text-brand-dark">{sub.name}</h3>
                        {sub.description && <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>}
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Mín: {sub.min_selections}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Máx: {sub.max_selections}</span>
                          {sub.is_required && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Obrigatório</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSubcategoryForItem(sub);
                            setEditingSubItem(null);
                            setSubItemForm({ name: '', description: '', price: '0', image_url: '' });
                            setSubItemImageFile(null);
                            setSubItemImagePreview(null);
                            setShowSubItemModal(true);
                            fetchSubItems(sub.id);
                          }}
                          className="text-xs bg-brand-light text-brand-primary px-3 py-1.5 rounded-lg font-bold hover:bg-green-100 transition-colors flex items-center gap-1"
                        >
                          <Plus size={14} /> Novo Item
                        </button>
                        <button onClick={() => {
                          setEditingSubcategory(sub);
                          setSubcategoryForm({ name: sub.name, description: sub.description || '', min_selections: sub.min_selections.toString(), max_selections: sub.max_selections.toString(), is_required: sub.is_required });
                          setShowSubcategoryModal(true);
                        }} className="p-2 text-gray-400 hover:text-blue-500"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteSubcategory(sub.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <SubItemsList subcategoryId={sub.id} storeId={store!.id} onEdit={(item) => {
                      setSelectedSubcategoryForItem(sub);
                      setEditingSubItem(item);
                      setSubItemForm({ name: item.name, description: item.description || '', price: item.price.toString(), image_url: item.image_url || '' });
                      setSubItemImageFile(null);
                      setSubItemImagePreview(item.image_url || null);
                      fetchSubItems(sub.id);
                      setShowSubItemModal(true);
                    }} onDelete={(id) => handleDeleteSubItem(id)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRODUTOS */}
          {activeTab === 'products' && !showSubcategoryPanel && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-dark">Gestão de Cardápio</h2>
                <button onClick={openNewProductModal} className="bg-brand-primary text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold flex items-center shadow-md hover:bg-green-600 transition-colors text-sm md:text-base">
                  <Plus size={20} className="mr-1 md:mr-2" /> <span className="hidden sm:inline">Novo Produto</span><span className="sm:hidden">Novo</span>
                </button>
              </div>

              {/* Produtos sem categoria */}
              {products.filter(p => !p.category_id).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                      <FolderTree size={18} className="text-gray-400" /> Sem categoria
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {products.filter(p => !p.category_id).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shrink-0"><ImageIcon size={20}/></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-brand-dark truncate">{p.name}</p>
                          <p className="text-xs text-gray-500 truncate">{p.description}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-brand-dark">R$ {p.price.toFixed(2)}</span>
                          <button onClick={() => toggleProductAvailability(p)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${p.is_available ? 'bg-brand-light text-brand-primary' : 'bg-gray-200 text-gray-600'}`}>
                            {p.is_available ? 'Ativo' : 'Pausado'}
                          </button>
                          <button onClick={() => openEditProductModal(p)} className="p-2 text-gray-400 hover:text-blue-500"><Edit2 size={16}/></button>
                          <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Produtos agrupados por categoria */}
              {productCategories.map(cat => {
                const catProducts = products.filter(p => p.category_id === cat.id);
                return (
                  <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Cabeçalho da categoria */}
                    <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <FolderTree size={18} className="text-brand-primary" />
                        {cat.name}
                        <span className="text-xs font-normal text-gray-400">({catProducts.length} produto{catProducts.length !== 1 ? 's' : ''})</span>
                      </h3>
                      <button
                        onClick={async () => {
                          setSelectedCategoryForSub(cat);
                          setShowSubcategoryPanel(true);
                          await fetchSubcategories(cat.id);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors border border-purple-200"
                      >
                        <Plus size={14} /> Gerenciar adicionais
                      </button>
                    </div>

                    {/* Produtos da categoria */}
                    {catProducts.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        Nenhum produto nesta categoria ainda.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {catProducts.map(p => (
                          <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shrink-0"><ImageIcon size={20}/></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-brand-dark truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 truncate">{p.description}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-brand-dark">R$ {p.price.toFixed(2)}</span>
                              <button onClick={() => toggleProductAvailability(p)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${p.is_available ? 'bg-brand-light text-brand-primary' : 'bg-gray-200 text-gray-600'}`}>
                                {p.is_available ? 'Ativo' : 'Pausado'}
                              </button>
                              <button onClick={() => openEditProductModal(p)} className="p-2 text-gray-400 hover:text-blue-500"><Edit2 size={16}/></button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {products.length === 0 && productCategories.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                  <Package size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="font-medium">Nenhum produto cadastrado ainda.</p>
                  <p className="text-sm mt-1">Clique em "Novo Produto" para começar a vender.</p>
                </div>
              )}
            </div>
          )}

          {/* SUBCATEGORIAS PANEL — acessível também pela aba de produtos */}
          {activeTab === 'products' && showSubcategoryPanel && selectedCategoryForSub && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => { setShowSubcategoryPanel(false); setSubcategories([]); setSubItems([]); setSelectedSubcategoryForItem(null); }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-brand-dark">Adicionais do Cardápio</h2>
                  <p className="text-sm text-gray-500">Categoria: <span className="font-bold text-brand-primary">{selectedCategoryForSub.name}</span> — aparecem em todos os produtos desta categoria</p>
                </div>
                <button
                  onClick={() => {
                    setEditingSubcategory(null);
                    setSubcategoryForm({ name: '', description: '', min_selections: '0', max_selections: '5', is_required: false });
                    setShowSubcategoryModal(true);
                  }}
                  className="ml-auto bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-green-600 transition-colors text-sm"
                >
                  <Plus size={18} className="mr-1" /> Novo Grupo
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-700">
                💡 Os grupos de adicionais criados aqui aparecem automaticamente quando o cliente abre qualquer produto da categoria <strong>{selectedCategoryForSub.name}</strong>.
              </div>

              {subcategories.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                  <Plus size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="font-medium">Nenhum grupo de adicionais criado.</p>
                  <p className="text-sm mt-1">Clique em "Novo Grupo" para criar grupos como "Molhos", "Extras", "Tamanho".</p>
                </div>
              )}

              <div className="space-y-4">
                {subcategories.map(sub => (
                  <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="p-4 flex items-center justify-between border-b border-gray-100">
                      <div>
                        <h3 className="font-bold text-brand-dark">{sub.name}</h3>
                        {sub.description && <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>}
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Mín: {sub.min_selections}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Máx: {sub.max_selections}</span>
                          {sub.is_required && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Obrigatório</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSubcategoryForItem(sub);
                            setEditingSubItem(null);
                            setSubItemForm({ name: '', description: '', price: '0', image_url: '' });
                            setSubItemImageFile(null);
                            setSubItemImagePreview(null);
                            setShowSubItemModal(true);
                            fetchSubItems(sub.id);
                          }}
                          className="text-xs bg-brand-light text-brand-primary px-3 py-1.5 rounded-lg font-bold hover:bg-green-100 transition-colors flex items-center gap-1"
                        >
                          <Plus size={14} /> Novo Item
                        </button>
                        <button onClick={() => {
                          setEditingSubcategory(sub);
                          setSubcategoryForm({ name: sub.name, description: sub.description || '', min_selections: sub.min_selections.toString(), max_selections: sub.max_selections.toString(), is_required: sub.is_required });
                          setShowSubcategoryModal(true);
                        }} className="p-2 text-gray-400 hover:text-blue-500"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteSubcategory(sub.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <SubItemsList subcategoryId={sub.id} storeId={store!.id} onEdit={(item) => {
                      setSelectedSubcategoryForItem(sub);
                      setEditingSubItem(item);
                      setSubItemForm({ name: item.name, description: item.description || '', price: item.price.toString(), image_url: item.image_url || '' });
                      setSubItemImageFile(null);
                      setSubItemImagePreview(item.image_url || null);
                      fetchSubItems(sub.id);
                      setShowSubItemModal(true);
                    }} onDelete={(id) => handleDeleteSubItem(id)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUPONS */}
          {activeTab === 'coupons' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">Cupons de Desconto</h2>
                <button onClick={() => { setCouponForm({ code: '', type: 'percentage', value: '', min_order_value: '0', expires_at: '', is_active: true }); setShowCouponModal(true); }} className="bg-brand-primary text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold flex items-center shadow-md hover:bg-green-600 transition-colors text-sm md:text-base">
                  <Plus size={20} className="mr-1 md:mr-2" /> <span className="hidden sm:inline">Novo Cupom</span><span className="sm:hidden">Novo</span>
                </button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">Código</th>
                      <th className="p-4 font-medium">Desconto</th>
                      <th className="p-4 font-medium">Pedido Mínimo</th>
                      <th className="p-4 font-medium">Validade</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coupons.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <span className="font-black text-brand-dark bg-gray-100 px-3 py-1.5 rounded-lg tracking-wider border border-gray-200">{c.code}</span>
                        </td>
                        <td className="p-4 font-bold text-brand-primary">
                          {c.type === 'percentage' ? `${c.value}%` : `R$ ${c.value.toFixed(2)}`}
                        </td>
                        <td className="p-4 text-gray-600 text-sm">
                          {c.min_order_value > 0 ? `R$ ${c.min_order_value.toFixed(2)}` : 'Sem mínimo'}
                        </td>
                        <td className="p-4 text-gray-600 text-sm">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}
                        </td>
                        <td className="p-4">
                          <button onClick={() => toggleCouponStatus(c)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${c.is_active ? 'bg-brand-light text-brand-primary hover:bg-green-100' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                            {c.is_active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                    {coupons.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-gray-500">
                          <div className="flex flex-col items-center justify-center">
                            <Ticket size={48} className="text-gray-300 mb-4" />
                            <p className="font-medium">Nenhuma cupom criado ainda.</p>
                            <p className="text-sm mt-1">Crie promoções para atrair mais clientes!</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AVALIAÇÕES */}
          {activeTab === 'reviews' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">Avaliações dos Clientes</h2>
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center">
                  <Star className="text-yellow-400 mr-2 fill-current" size={20} />
                  <span className="font-black text-brand-dark text-lg">{store.avg_rating > 0 ? store.avg_rating.toFixed(1) : '—'}</span>
                  <span className="text-gray-400 text-sm ml-2 font-medium hidden sm:inline">({reviews.length} avaliações)</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map(review => (
                  <div key={review.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-light text-brand-primary rounded-full flex items-center justify-center font-black">
                          {review.users?.name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="font-bold text-brand-dark">{review.users?.name || 'Cliente'}</p>
                          <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-200'} />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl italic">"{review.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
              
              {reviews.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <Star size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium text-lg">Nenhuma avaliação recebida ainda.</p>
                  <p className="text-gray-400 text-sm mt-1">Continue prestando um ótimo serviço para receber 5 estrelas!</p>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-8 pb-8">
              <h2 className="text-2xl md:text-3xl font-black text-brand-dark">Configurações da Loja</h2>

              {/* Store Profile Settings */}
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-xl text-brand-dark mb-4 flex items-center"><StoreIcon size={20} className="mr-2 text-brand-primary"/> Perfil da Loja</h3>
                <form onSubmit={(e) => handleUpdateStoreSettings(e, 'profile')} className="space-y-5">
                  <div className="flex flex-col items-center justify-center mb-4">
                    <label htmlFor="logo-upload" className="w-32 h-32 rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative shadow-inner cursor-pointer hover:bg-gray-200 transition-colors group">
                      {logoPreview ? (
                        <>
                          <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                            <span className="text-white font-bold text-sm flex items-center"><UploadCloud size={18} className="mr-2"/> Trocar</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <ImageIcon size={32} className="mb-1" />
                          <span className="text-[10px] font-bold uppercase text-center leading-tight px-2">Adicionar<br/>Logo</span>
                        </div>
                      )}
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 mt-3 text-center">
                      Envie o logo da sua loja (JPG, PNG, max 2MB).
                    </p>
                  </div>

                  {/* Banner Upload */}
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Banner da Loja</label>
                    <div className="flex flex-col items-center justify-center">
                      <label htmlFor="banner-upload" className="w-full h-32 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-gray-100 transition-colors group">
                        {bannerPreview ? (
                          <>
                            <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white font-bold text-sm flex items-center"><UploadCloud size={18} className="mr-2"/> Trocar Banner</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-gray-400">
                            <ImageIcon size={32} className="mb-2" />
                            <span className="text-sm font-bold">Clique para enviar banner</span>
                            <span className="text-xs mt-1">Max: 5MB</span>
                          </div>
                        )}
                      </label>
                      <input
                        id="banner-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleBannerFileChange}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-3 text-center">
                        Envie uma imagem de banner para sua loja (JPG, PNG, max 5MB).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-1">Nome da Loja</label>
                    <input type="text" id="name" name="name" value={settingsForm.name} onChange={handleSettingsChange} required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                    <input type="tel" id="phone" name="phone" value={settingsForm.phone} onChange={handleSettingsChange} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <button type="submit" disabled={settingsLoading} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex justify-center items-center hover:bg-green-600 transition-colors">
                    {settingsLoading ? <Loader2 size={20} className="animate-spin"/> : 'Salvar Perfil da Loja'}
                  </button>
                </form>
              </div>

              {/* Delivery Settings */}
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-xl text-brand-dark mb-4 flex items-center"><Bike size={20} className="mr-2 text-brand-primary"/> Configurações de Entrega</h3>
                <form onSubmit={(e) => handleUpdateStoreSettings(e, 'delivery')} className="space-y-5">
                  <div>
                    <label htmlFor="delivery_fee" className="block text-sm font-bold text-gray-700 mb-1">Taxa de Entrega Padrão (R$)</label>
                    <input type="number" step="0.01" id="delivery_fee" name="delivery_fee" value={settingsForm.delivery_fee} onChange={handleSettingsChange} required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <div>
                    <label htmlFor="min_order_value" className="block text-sm font-bold text-gray-700 mb-1">Valor Mínimo do Pedido (R$)</label>
                    <input type="number" step="0.01" id="min_order_value" name="min_order_value" value={settingsForm.min_order_value} onChange={handleSettingsChange} required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <div>
                    <label htmlFor="avg_prep_time_min" className="block text-sm font-bold text-gray-700 mb-1">Tempo Médio de Preparo (minutos)</label>
                    <input type="number" id="avg_prep_time_min" name="avg_prep_time_min" value={settingsForm.avg_prep_time_min} onChange={handleSettingsChange} required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <button type="submit" disabled={settingsLoading} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex justify-center items-center hover:bg-green-600 transition-colors">
                    {settingsLoading ? <Loader2 size={20} className="animate-spin"/> : 'Salvar Configurações de Entrega'}
                  </button>
                </form>
              </div>

              {/* Payment Methods */}
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-xl text-brand-dark mb-4 flex items-center"><CreditCard size={20} className="mr-2 text-brand-primary"/> Formas de Pagamento</h3>
                <form onSubmit={(e) => handleUpdateStoreSettings(e, 'payment')} className="space-y-4">
                  <label className="flex items-center text-gray-700 font-medium">
                    <input type="checkbox" name="accepts_pix" checked={settingsForm.accepts_pix} onChange={handleSettingsChange} className="mr-3 w-5 h-5 accent-brand-primary" />
                    Aceita PIX
                  </label>
                  <label className="flex items-center text-gray-700 font-medium">
                    <input type="checkbox" name="accepts_card" checked={settingsForm.accepts_card} onChange={handleSettingsChange} className="mr-3 w-5 h-5 accent-brand-primary" />
                    Aceita Cartão (Débito/Crédito)
                  </label>
                  <label className="flex items-center text-gray-700 font-medium">
                    <input type="checkbox" name="accepts_cash" checked={settingsForm.accepts_cash} onChange={handleSettingsChange} className="mr-3 w-5 h-5 accent-brand-primary" />
                    Aceita Dinheiro
                  </label>
                  <button type="submit" disabled={settingsLoading} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex justify-center items-center hover:bg-green-600 transition-colors mt-5">
                    {settingsLoading ? <Loader2 size={20} className="animate-spin"/> : 'Salvar Formas de Pagamento'}
                  </button>
                </form>
              </div>

              {/* Password Change */}
              <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-xl text-brand-dark mb-4 flex items-center"><Lock size={20} className="mr-2 text-brand-primary"/> Alterar Senha</h3>
                <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-bold text-gray-700 mb-1">Nova Senha</label>
                    <input type="password" id="newPassword" name="newPassword" value={settingsForm.newPassword} onChange={handleSettingsChange} required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-1">Confirmar Nova Senha</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" value={settingsForm.confirmPassword} onChange={handleSettingsChange} required className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none" />
                  </div>
                  <button type="submit" disabled={settingsLoading || !settingsForm.newPassword || !settingsForm.confirmPassword} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex justify-center items-center hover:bg-green-600 transition-colors">
                    {settingsLoading ? <Loader2 size={20} className="animate-spin"/> : 'Alterar Senha'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-brand-dark">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Categoria</label>
                <input type="text" required placeholder="Ex: Lanches, Bebidas" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Ordem de Exibição</label>
                  <input type="number" required value={categoryForm.sort_order} onChange={e => setCategoryForm({...categoryForm, sort_order: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                  <p className="text-[10px] text-gray-500 mt-1">Menor número aparece primeiro</p>
                </div>
                <div className="flex-1 flex items-center pt-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={categoryForm.is_active} onChange={e => setCategoryForm({...categoryForm, is_active: e.target.checked})} className="mr-2 w-5 h-5 accent-brand-primary" />
                    <span className="font-bold text-gray-700">Ativa</span>
                  </label>
                </div>
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                <button type="submit" disabled={actionLoading === -3} className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center hover:bg-green-600 transition-colors">
                  {actionLoading === -3 ? <Loader2 size={20} className="animate-spin"/> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-brand-dark">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              
              {/* IMAGE UPLOAD AREA */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Foto do Produto</label>
                <div className="flex flex-col items-center justify-center">
                  <label htmlFor="product-image-upload" className="w-full h-40 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-gray-100 transition-colors group">
                    {productImagePreview ? (
                      <>
                        <img src={productImagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white font-bold text-sm flex items-center"><UploadCloud size={18} className="mr-2"/> Trocar Imagem</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <ImageIcon size={32} className="mb-2" />
                        <span className="text-sm font-bold">Clique para enviar foto</span>
                        <span className="text-xs mt-1">Max: 5MB</span>
                      </div>
                    )}
                  </label>
                  <input
                    id="product-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleProductImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Produto</label>
                <input type="text" required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
                <select value={productForm.category_id} onChange={e => setProductForm({...productForm, category_id: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-primary outline-none bg-white">
                  <option value="">Sem categoria</option>
                  {productCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
                <textarea required value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none h-20 resize-none" />
              </div>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Preço (R$)</label>
                  <input type="number" step="0.01" required value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="flex-1 flex items-end pb-2">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={productForm.is_available} onChange={e => setProductForm({...productForm, is_available: e.target.checked})} className="mr-2 w-5 h-5 accent-brand-primary" />
                    <span className="font-bold text-gray-700">Disponível</span>
                  </label>
                </div>
              </div>
              
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                <button type="submit" disabled={actionLoading === -1} className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center hover:bg-green-600 transition-colors">
                  {actionLoading === -1 ? <Loader2 size={20} className="animate-spin"/> : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COUPON MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-brand-dark flex items-center"><Ticket className="mr-2 text-brand-primary" size={24}/> Novo Cupom</h2>
              <button onClick={() => setShowCouponModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveCoupon} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Código do Cupom</label>
                <input type="text" required placeholder="Ex: BEMVINDO10" value={couponForm.code} onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none uppercase font-bold tracking-wider" />
              </div>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Desconto</label>
                  <select value={couponForm.type} onChange={e => setCouponForm({...couponForm, type: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-primary outline-none bg-white">
                    <option value="percentage">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Valor</label>
                  <input type="number" step="0.01" required placeholder={couponForm.type === 'percentage' ? '10' : '15.00'} value={couponForm.value} onChange={e => setCouponForm({...couponForm, value: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
              </div>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Pedido Mínimo (R$)</label>
                  <input type="number" step="0.01" value={couponForm.min_order_value} onChange={e => setCouponForm({...couponForm, min_order_value: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Validade (Opcional)</label>
                  <input type="date" value={couponForm.expires_at} onChange={e => setCouponForm({...couponForm, expires_at: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none text-sm" />
                </div>
              </div>
              
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setShowCouponModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                <button type="submit" disabled={actionLoading === -2} className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center">
                  {actionLoading === -2 ? <Loader2 size={20} className="animate-spin"/> : 'Criar Cupom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBCATEGORY MODAL */}
      {showSubcategoryModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-brand-dark">{editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}</h2>
              <button onClick={() => setShowSubcategoryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveSubcategory} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do grupo *</label>
                <input type="text" required placeholder="Ex: Adicionais, Tamanho, Complementos" value={subcategoryForm.name} onChange={e => setSubcategoryForm({...subcategoryForm, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição (opcional)</label>
                <input type="text" placeholder="Ex: Escolha até 3 complementos" value={subcategoryForm.description} onChange={e => setSubcategoryForm({...subcategoryForm, description: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mínimo</label>
                  <input type="number" min="0" value={subcategoryForm.min_selections} onChange={e => setSubcategoryForm({...subcategoryForm, min_selections: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Máximo</label>
                  <input type="number" min="1" value={subcategoryForm.max_selections} onChange={e => setSubcategoryForm({...subcategoryForm, max_selections: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={subcategoryForm.is_required} onChange={e => setSubcategoryForm({...subcategoryForm, is_required: e.target.checked})} className="w-5 h-5 accent-brand-primary" />
                <span className="font-bold text-gray-700">Obrigatório</span>
                <span className="text-xs text-gray-500">(cliente precisa escolher antes de adicionar ao carrinho)</span>
              </label>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowSubcategoryModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                <button type="submit" disabled={actionLoading === -10} className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center">
                  {actionLoading === -10 ? <Loader2 size={20} className="animate-spin"/> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB ITEM MODAL */}
      {showSubItemModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-dark">{editingSubItem ? 'Editar Item' : 'Novo Item'}</h2>
                {selectedSubcategoryForItem && <p className="text-xs text-gray-500">Em: {selectedSubcategoryForItem.name}</p>}
              </div>
              <button onClick={() => setShowSubItemModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveSubItem} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Foto do item</label>
                <label htmlFor="subitem-image-upload" className="w-full h-32 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-gray-100 transition-colors group">
                  {subItemImagePreview ? (
                    <>
                      <img src={subItemImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white font-bold text-sm">Trocar</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <ImageIcon size={28} className="mb-1" />
                      <span className="text-sm font-bold">Clique para enviar foto</span>
                    </div>
                  )}
                </label>
                <input id="subitem-image-upload" type="file" accept="image/*" onChange={e => {
                  if (e.target.files?.[0]) {
                    setSubItemImageFile(e.target.files[0]);
                    const r = new FileReader();
                    r.onload = ev => setSubItemImagePreview(ev.target?.result as string);
                    r.readAsDataURL(e.target.files[0]);
                  }
                }} className="hidden" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do item *</label>
                <input type="text" required placeholder="Ex: Bacon, Queijo extra, 300ml" value={subItemForm.name} onChange={e => setSubItemForm({...subItemForm, name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Descrição (opcional)</label>
                <input type="text" placeholder="Ex: Fatia grossa de bacon crocante" value={subItemForm.description} onChange={e => setSubItemForm({...subItemForm, description: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Preço adicional (R$)</label>
                <input type="number" step="0.01" min="0" value={subItemForm.price} onChange={e => setSubItemForm({...subItemForm, price: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-primary outline-none" />
                <p className="text-xs text-gray-500 mt-1">Use 0 para itens sem custo adicional</p>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowSubItemModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                <button type="submit" disabled={actionLoading === -11} className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center">
                  {actionLoading === -11 ? <Loader2 size={20} className="animate-spin"/> : 'Salvar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO GENÉRICO */}
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

      {/* Modal: notificar clientes sobre o cupom */}
      {showNotifyModal && store && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <BellRing size={28} className="text-brand-primary" />
              </div>
              <h2 className="text-xl font-black text-gray-800">Cupom criado! 🎉</h2>
              <p className="text-gray-500 text-sm mt-2">
                Quer avisar os clientes da sua cidade sobre o cupom <span className="font-bold text-brand-primary">{newCouponCode}</span>?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  setSendingCouponNotif(true);
                  try {
                    const { data: notif } = await supabase
                      .from('notifications')
                      .insert({
                        created_by: user!.id,
                        title: `🎁 Cupom especial de ${store.name}!`,
                        body: `Use o código ${newCouponCode} e ganhe desconto no seu próximo pedido!`,
                        target_type: 'city',
                        target_city: store.addresses?.city || null,
                        store_id: store.id,
                        status: 'pending',
                      })
                      .select()
                      .single();

                    await supabase.functions.invoke('send-push', {
                      body: {
                        notificationId: notif?.id,
                        title: `🎁 Cupom especial de ${store.name}!`,
                        body: `Use o código ${newCouponCode} e ganhe desconto no seu próximo pedido!`,
                        targetType: 'city',
                        targetCity: store.addresses?.city || null,
                      }
                    });

                    showToast('Clientes notificados! 🔔', 'success');
                  } catch {
                    showToast('Cupom criado, mas falha ao notificar.', 'warning');
                  } finally {
                    setSendingCouponNotif(false);
                    setShowNotifyModal(false);
                    setNewCouponCode('');
                  }
                }}
                disabled={sendingCouponNotif}
                className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {sendingCouponNotif
                  ? <Loader2 size={18} className="animate-spin" />
                  : <BellRing size={18} />}
                Sim, notificar clientes da cidade
              </button>

              <button
                onClick={() => { setShowNotifyModal(false); setNewCouponCode(''); }}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
