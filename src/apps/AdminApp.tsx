import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Store, Bike, LogOut, CheckCircle, XCircle, Loader2, Users, Eye, X, MapPin, FileText, DollarSign, Clock, CreditCard, User, ShoppingBag, Package, MessageSquare, Ticket, Star, Trash2, Search, Percent, BarChart3, BellRing } from 'lucide-react';
import { Toast } from '../components/Toast';

export default function AdminApp({ onExit }: { onExit: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => setToast({ message, type });
  
  // Dados
  const [stores, setStores] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  
  // Dashboard Metrics & Filters (Global)
  const [dashboardFilter, setDashboardFilter] = useState<'today' | '7days' | '15days' | '30days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dashboardStoreFilter, setDashboardStoreFilter] = useState('all');
  
  const [dashboardMetrics, setDashboardMetrics] = useState({
    pedidos: 0,
    entregues: 0,
    faturamento: 0,
    comissao: 0,
    motoboysOnline: 0,
    lojasAbertas: 0
  });

  // Store Analysis Section (Bottom)
  const [analysisOrders, setAnalysisOrders] = useState<any[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Orders Tab
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderDateFilter, setOrderDateFilter] = useState('today');
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const ADMIN_PAGE_SIZE = 25;

  const [viewOrder, setViewOrder] = useState<any>(null);
  
  // Reviews & Coupons Tabs
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [reviewRatingFilter, setReviewRatingFilter] = useState('all');
  
  const [allCoupons, setAllCoupons] = useState<any[]>([]);
  const [couponStoreFilter, setCouponStoreFilter] = useState('all');

  // Repasses Tab
  const [storeRepasses, setStoreRepasses] = useState<{ name: string; amount: number; walletId: string }[]>([]);
  const [courierRepasses, setCourierRepasses] = useState<{ name: string; amount: number; walletId: string }[]>([]);
  const [repassesLoading, setRepassesLoading] = useState(false);
  const [repassesTotal, setRepassesTotal] = useState({ stores: 0, couriers: 0, platform: 0 });

  // Notifications Tab
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifForm, setNotifForm] = useState({
    title: '',
    body: '',
    targetType: 'all',
    targetCity: '',
    scheduledAt: '',
    repeatType: '',
    repeatDay: 0,
    repeatHour: 18,
  });
  const [sendingNotif, setSendingNotif] = useState(false);

  // Filtros internos (Abas)
  const [storeFilter, setStoreFilter] = useState<'pending' | 'approved'>('pending');
  const [courierFilter, setCourierFilter] = useState<'pending' | 'approved'>('pending');

  // Modais de Detalhes
  const [viewStore, setViewStore] = useState<any>(null);
  const [viewCourier, setViewCourier] = useState<any>(null);
  const [editCommission, setEditCommission] = useState<string>('');
  
  // Modal de Confirmação
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardMetrics();
      fetchAnalysisData();
    }
  }, [activeTab, dashboardFilter, customStartDate, customEndDate, dashboardStoreFilter]);

  useEffect(() => {
    if (activeTab === 'stores' || activeTab === 'couriers' || activeTab === 'clients') {
      fetchData();
    }
    if (activeTab === 'orders') {
      setOrdersPage(0);
      setAdminOrders([]);
      setOrdersHasMore(true);
      fetchAdminOrders(0, false);
    }
    if (activeTab === 'reviews') fetchAllReviews();
    if (activeTab === 'coupons') fetchAllCoupons();
    if (activeTab === 'repasses') fetchRepasses();
    if (activeTab === 'notifications') fetchNotifications();
  }, [activeTab, orderStatusFilter, orderDateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storesRes, couriersRes, clientsRes] = await Promise.all([
        supabase
          .from('stores')
          .select('*, users:owner_id(name, email, phone), addresses(*)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('couriers')
          .select('*, users:user_id(name, email, phone, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('users')
          .select('*')
          .eq('role', 'client')
          .order('created_at', { ascending: false })
      ]);
      
      if (storesRes.data) setStores(storesRes.data);
      if (couriersRes.data) setCouriers(couriersRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar dados iniciais', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardMetrics = async () => {
    setLoading(true);
    try {
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
        if (!customStartDate || !customEndDate) {
          setLoading(false);
          return;
        }
        const startParts = customStartDate.split('-');
        startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
        startDate.setHours(0, 0, 0, 0);
        const endParts = customEndDate.split('-');
        endDate = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
        endDate.setHours(23, 59, 59, 999);
      }

      let query = supabase
        .from('orders')
        .select('total, delivery_fee, status, stores(commission_rate)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (dashboardStoreFilter !== 'all') {
        query = query.eq('store_id', dashboardStoreFilter);
      }

      const [ordersRes, onlineCouriersRes, openStoresRes] = await Promise.all([
        query,
        supabase.from('couriers').select('id', { count: 'exact' }).eq('is_online', true),
        supabase.from('stores').select('id', { count: 'exact' }).eq('is_open', true).eq('is_approved', true)
      ]);

      if (ordersRes.data) {
        const entregues = ordersRes.data.filter(o => o.status === 'delivered');
        let faturamentoTotal = 0;
        let comissaoTotal = 0;

        entregues.forEach(o => {
          faturamentoTotal += o.total;
          const baseValue = Math.max(0, o.total - (o.delivery_fee || 0));
          const rate = o.stores?.commission_rate ?? 4;
          comissaoTotal += baseValue * (rate / 100);
        });

        setDashboardMetrics({
          pedidos: ordersRes.data.length,
          entregues: entregues.length,
          faturamento: faturamentoTotal,
          comissao: comissaoTotal,
          motoboysOnline: onlineCouriersRes.count || 0,
          lojasAbertas: openStoresRes.count || 0
        });
      }
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar métricas do dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysisData = async () => {
    setAnalysisLoading(true);
    try {
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
        if (!customStartDate || !customEndDate) {
          setAnalysisLoading(false);
          return;
        }
        const startParts = customStartDate.split('-');
        startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
        startDate.setHours(0, 0, 0, 0);
        const endParts = customEndDate.split('-');
        endDate = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
        endDate.setHours(23, 59, 59, 999);
      }

      let query = supabase
        .from('orders')
        .select('id, total, delivery_fee, status, payment_method, cancel_reason, created_at, users:client_id(name), stores(name, commission_rate)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (dashboardStoreFilter !== 'all') {
        query = query.eq('store_id', dashboardStoreFilter);
      }

      const { data } = await query;
      if (data) setAnalysisOrders(data);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar dados de análise', 'error');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchAdminOrders = async (page = 0, append = false) => {
    setLoading(true);
    try {
      let startDate = new Date();
      let endDate = new Date();
      
      if (orderDateFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (orderDateFilter === 'yesterday') {
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (orderDateFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
      }

      let query = supabase
        .from('orders')
        .select('*, users:client_id(name), stores(name), couriers(users:user_id(name)), addresses(*), order_items(*)')
        .order('created_at', { ascending: false })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (orderStatusFilter !== 'all') {
        query = query.eq('status', orderStatusFilter);
      }

      const from = page * ADMIN_PAGE_SIZE;
      const to = from + ADMIN_PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data } = await query;
      if (data) {
        setAdminOrders(prev => append ? [...prev, ...data] : data);
        setOrdersHasMore(data.length === ADMIN_PAGE_SIZE);
      }
    } catch (error) {
      showToast('Erro ao carregar pedidos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReviews = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select('*, users:reviewer_id(name), orders(store_id, stores(name))')
        .eq('target_type', 'store')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setAllReviews(data);
    } catch {
      showToast('Erro ao carregar avaliações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCoupons = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('coupons')
        .select('*, stores(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) setAllCoupons(data);
    } catch {
      showToast('Erro ao carregar cupons', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepasses = async () => {
    setRepassesLoading(true);
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      lastMonday.setHours(0, 0, 0, 0);

      const { data: payments } = await supabase
        .from('payments')
        .select(`
          split_store_amount,
          split_courier_amount,
          split_platform_amount,
          orders(
            store_id,
            courier_id,
            stores(name, asaas_wallet_id),
            couriers(users:user_id(name), asaas_wallet_id)
          )
        `)
        .eq('status', 'confirmed')
        .gte('confirmed_at', lastMonday.toISOString());

      const storeMap: Record<number, { name: string; amount: number; walletId: string }> = {};
      const courierMap: Record<number, { name: string; amount: number; walletId: string }> = {};
      let platformTotal = 0;

      (payments || []).forEach((p: any) => {
        const storeId = p.orders?.store_id;
        const courierId = p.orders?.courier_id;

        if (storeId && (p.split_store_amount || 0) > 0) {
          if (!storeMap[storeId]) {
            storeMap[storeId] = {
              name: p.orders?.stores?.name || 'Loja',
              amount: 0,
              walletId: p.orders?.stores?.asaas_wallet_id || ''
            };
          }
          storeMap[storeId].amount += p.split_store_amount || 0;
        }

        if (courierId && (p.split_courier_amount || 0) > 0) {
          if (!courierMap[courierId]) {
            courierMap[courierId] = {
              name: p.orders?.couriers?.users?.name || 'Motoboy',
              amount: 0,
              walletId: p.orders?.couriers?.asaas_wallet_id || ''
            };
          }
          courierMap[courierId].amount += p.split_courier_amount || 0;
        }

        platformTotal += p.split_platform_amount || 0;
      });

      const storeList = Object.values(storeMap).sort((a, b) => b.amount - a.amount);
      const courierList = Object.values(courierMap).sort((a, b) => b.amount - a.amount);

      setStoreRepasses(storeList);
      setCourierRepasses(courierList);
      setRepassesTotal({
        stores: storeList.reduce((acc, s) => acc + s.amount, 0),
        couriers: courierList.reduce((acc, c) => acc + c.amount, 0),
        platform: platformTotal
      });
    } catch (err) {
      console.error('fetchRepasses error:', err);
      showToast('Erro ao carregar repasses', 'error');
    } finally {
      setRepassesLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, stores(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifForm.title || !notifForm.body) return;
    setSendingNotif(true);
    try {
      // 1. Salva a notificação no banco
      const { data: notif, error } = await supabase.from('notifications').insert({
        created_by: user!.id,
        title: notifForm.title,
        body: notifForm.body,
        target_type: notifForm.targetType,
        target_city: notifForm.targetCity || null,
        scheduled_at: notifForm.scheduledAt ? new Date(notifForm.scheduledAt).toISOString() : null,
        repeat_type: notifForm.repeatType || null,
        repeat_day: notifForm.repeatType === 'weekly' ? notifForm.repeatDay : null,
        repeat_hour: notifForm.repeatHour,
        status: notifForm.scheduledAt ? 'scheduled' : 'pending',
      }).select().single();

      if (error) throw error;

      // 2. Se não agendada, dispara imediatamente
      if (!notifForm.scheduledAt) {
        await supabase.functions.invoke('send-push', {
          body: {
            notificationId: notif.id,
            title: notifForm.title,
            body: notifForm.body,
            targetType: notifForm.targetType,
            targetCity: notifForm.targetCity || null,
          }
        });
        showToast('Notificação enviada! 🔔', 'success');
      } else {
        showToast('Notificação agendada! ✅', 'success');
      }

      setShowNotifModal(false);
      setNotifForm({ title: '', body: '', targetType: 'all', targetCity: '', scheduledAt: '', repeatType: '', repeatDay: 0, repeatHour: 18 });
      fetchNotifications();
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar notificação', 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  const openCourierDetails = async (courier: any) => {
    setLoading(true);
    try {
      const { data: address } = await supabase.from('addresses').select('*').eq('user_id', courier.user_id).maybeSingle();
      setViewCourier({ ...courier, address });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const extractEdgeFunctionErrorMessage = async (
    error: any,
    fallback = 'erro desconhecido'
  ) => {
    if (!error) return fallback;

    try {
      const response = error?.context;
      if (response && typeof response.clone === 'function') {
        const payload = await response.clone().json();
        if (payload?.error) return payload.error;
        if (payload?.message) return payload.message;
      }
    } catch {
      // ignora erro de parse e segue com mensagem padrão
    }

    return error?.message || fallback;
  };

  const handleApproveStore = async (storeId: number, ownerId: string) => {
    setLoading(true);
    try {
      await supabase.from('stores').update({ is_approved: true, status: 'active' }).eq('id', storeId);
      await supabase.from('users').update({ is_active: true }).eq('id', ownerId);

      // Cria subconta Asaas se ainda não existir
      const { data: storeData } = await supabase
        .from('stores')
        .select('asaas_wallet_id')
        .eq('id', storeId)
        .single();

      if (!storeData?.asaas_wallet_id) {
        const { data: result, error: asaasErr } = await supabase.functions.invoke('create-asaas-account', {
          body: { entityType: 'store', entityId: storeId }
        });
        if (asaasErr || !result?.success) {
          const asaasMessage = result?.error || await extractEdgeFunctionErrorMessage(asaasErr);
          console.error('Erro ao criar subconta Asaas da loja:', asaasErr, result);
          showToast(`Loja aprovada, mas houve erro ao criar conta de pagamentos: ${asaasMessage}`, 'warning');
        } else {
          showToast('Loja aprovada e conta de pagamentos criada!');
        }
      } else {
        showToast('Loja aprovada com sucesso!');
      }

      setViewStore(null);
      fetchData();
    } catch (error) {
      showToast('Erro ao aprovar loja', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectStore = (storeId: number, ownerId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Recusar Loja',
      message: 'Tem certeza que deseja recusar e excluir o cadastro desta loja? O usuário precisará se cadastrar novamente.',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          await supabase.from('stores').delete().eq('id', storeId);
          await supabase.from('users').delete().eq('id', ownerId);
          setViewStore(null);
          fetchData();
          showToast('Loja recusada e excluída.');
        } catch (error) {
          showToast('Erro ao recusar loja.', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleUpdateCommission = async () => {
    if (!viewStore) return;
    try {
      const newRate = parseFloat(editCommission);
      if (isNaN(newRate) || newRate < 0 || newRate > 100) {
        return showToast('Valor de comissão inválido', 'warning');
      }
      await supabase.from('stores').update({ commission_rate: newRate }).eq('id', viewStore.id);
      setViewStore({ ...viewStore, commission_rate: newRate });
      fetchData();
      showToast('Comissão atualizada com sucesso!');
    } catch (error) {
      showToast('Erro ao atualizar comissão', 'error');
    }
  };

  const handleApproveCourier = async (courierId: number, userId: string) => {
    setLoading(true);
    try {
      await supabase.from('couriers').update({ is_approved: true, status: 'active' }).eq('id', courierId);
      await supabase.from('users').update({ is_active: true }).eq('id', userId);

      // Cria subconta Asaas se ainda não existir
      const { data: courierData } = await supabase
        .from('couriers')
        .select('asaas_wallet_id')
        .eq('id', courierId)
        .single();

      if (!courierData?.asaas_wallet_id) {
        const { data: result, error: asaasErr } = await supabase.functions.invoke('create-asaas-account', {
          body: { entityType: 'courier', entityId: courierId }
        });
        if (asaasErr || !result?.success) {
          const asaasMessage = result?.error || await extractEdgeFunctionErrorMessage(asaasErr);
          console.error('Erro ao criar subconta Asaas do motoboy:', asaasErr, result);
          showToast(`Motoboy aprovado, mas houve erro ao criar conta de pagamentos: ${asaasMessage}`, 'warning');
        } else {
          showToast('Motoboy aprovado e conta de pagamentos criada!');
        }
      } else {
        showToast('Motoboy aprovado com sucesso!');
      }

      setViewCourier(null);
      fetchData();
    } catch (error) {
      showToast('Erro ao aprovar motoboy', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCourier = (courierId: number, userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Recusar Motoboy',
      message: 'Tem certeza que deseja recusar e excluir o cadastro deste motoboy? O usuário precisará se cadastrar novamente.',
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          await supabase.from('couriers').delete().eq('id', courierId);
          await supabase.from('users').delete().eq('id', userId);
          setViewCourier(null);
          fetchData();
          showToast('Motoboy recusado e excluído.');
        } catch (error) {
          showToast('Erro ao recusar motoboy.', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDeleteReview = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Avaliação',
      message: 'Tem certeza que deseja excluir esta avaliação da plataforma?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await supabase.from('reviews').delete().eq('id', id);
          showToast('Avaliação excluída com sucesso');
          fetchAllReviews();
        } catch (error) {
          showToast('Erro ao excluir avaliação', 'error');
        }
      }
    });
  };

  const handleDeleteCoupon = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Cupom',
      message: 'Tem certeza que deseja excluir este cupom globalmente?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await supabase.from('coupons').delete().eq('id', id);
          showToast('Cupom excluído com sucesso');
          fetchAllCoupons();
        } catch (error) {
          showToast('Erro ao excluir cupom', 'error');
        }
      }
    });
  };

  const toggleCouponStatus = async (coupon: any) => {
    try {
      await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
      showToast(coupon.is_active ? 'Cupom pausado globalmente' : 'Cupom ativado globalmente');
      fetchAllCoupons();
    } catch (error) {
      showToast('Erro ao atualizar cupom', 'error');
    }
  };

  const isStoreApproved = (store: any) => store.is_approved === true;
  const isCourierApproved = (courier: any) => courier.is_approved === true;

  const pendingStoresCount = stores.filter(s => !isStoreApproved(s)).length;
  const approvedStoresCount = stores.filter(s => isStoreApproved(s)).length;
  const pendingCouriersCount = couriers.filter(c => !isCourierApproved(c)).length;
  const approvedCouriersCount = couriers.filter(c => isCourierApproved(c)).length;

  const filteredStores = stores.filter(s => storeFilter === 'approved' ? isStoreApproved(s) : !isStoreApproved(s));
  const filteredCouriers = couriers.filter(c => courierFilter === 'approved' ? isCourierApproved(c) : !isCourierApproved(c));

  const formatTime = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
  };

  const translateStatus = (status: string) => {
    const map: any = {
      pending: 'Pendente', accepted: 'Aceito', preparing: 'Em Preparo',
      ready: 'Pronto', delivering: 'Em Rota', delivered: 'Entregue', cancelled: 'Cancelado'
    };
    return map[status] || status;
  };

  // Cálculos para a seção de Análise de Loja
  const analysisEntregues = analysisOrders.filter(o => o.status === 'delivered');
  const analysisFaturamento = analysisEntregues.reduce((acc, o) => acc + o.total, 0);
  const analysisComissao = analysisEntregues.reduce((acc, o) => {
    const baseValue = Math.max(0, o.total - (o.delivery_fee || 0));
    const rate = o.stores?.commission_rate ?? 4;
    return acc + (baseValue * (rate / 100));
  }, 0);

  return (
    <div className="flex h-screen bg-gray-50 w-full font-sans" style={{paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)'}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* Menu Lateral */}
      <div className="w-64 bg-brand-dark text-white flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-emerald-800/50">
          <h1 className="text-2xl font-black flex items-center"><span className="text-brand-secondary mr-2">Tá Na Mão</span></h1>
          <p className="text-xs text-emerald-400 mt-1 uppercase tracking-widest font-bold">Admin Global</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'dashboard' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><LayoutDashboard size={20} /><span>Visão Geral</span></button>
          <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'orders' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><ShoppingBag size={20} /><span>Pedidos</span></button>
          <button onClick={() => setActiveTab('clients')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'clients' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><Users size={20} /><span>Clientes</span></button>
          <button onClick={() => setActiveTab('stores')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'stores' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><Store size={20} /><span>Lojas Parceiras</span></button>
          <button onClick={() => setActiveTab('couriers')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'couriers' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><Bike size={20} /><span>Motoboys</span></button>
          <button onClick={() => setActiveTab('coupons')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'coupons' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><Ticket size={20} /><span>Cupons</span></button>
          <button onClick={() => setActiveTab('reviews')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'reviews' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><Star size={20} /><span>Avaliações</span></button>
          <button onClick={() => setActiveTab('repasses')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'repasses' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><BarChart3 size={20} /><span>Repasses</span></button>
          <button onClick={() => setActiveTab('notifications')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'notifications' ? 'bg-brand-primary text-white shadow-md' : 'text-emerald-100 hover:bg-emerald-800/50'}`}><BellRing size={20} /><span>Notificações</span></button>
        </nav>
        <div className="p-4 border-t border-emerald-800/50">
          <button onClick={onExit} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-emerald-200 hover:bg-red-500 hover:text-white font-medium transition-colors"><LogOut size={20} /><span>Sair do Sistema</span></button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-40 flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={48}/></div>}
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-3xl font-black text-gray-800">Visão Geral</h2>
              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                <div className="flex gap-2 w-full md:w-auto">
                  <select 
                    value={dashboardStoreFilter} 
                    onChange={e => setDashboardStoreFilter(e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary w-full shadow-sm"
                  >
                    <option value="all">Todas as Lojas</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full overflow-x-auto scrollbar-hide">
                  <button onClick={() => setDashboardFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === 'today' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Hoje</button>
                  <button onClick={() => setDashboardFilter('7days')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === '7days' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>7 dias</button>
                  <button onClick={() => setDashboardFilter('15days')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === '15days' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>15 dias</button>
                  <button onClick={() => setDashboardFilter('30days')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === '30days' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>30 dias</button>
                  <button onClick={() => setDashboardFilter('custom')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dashboardFilter === 'custom' ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Personalizado</button>
                </div>
                {dashboardFilter === 'custom' && (
                  <div className="flex gap-2 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto justify-between">
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="text-sm border-none outline-none text-gray-700 bg-transparent" />
                    <span className="text-gray-400 text-sm font-medium">até</span>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="text-sm border-none outline-none text-gray-700 bg-transparent" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center mb-2">
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-500 mr-3"><ShoppingBag size={20}/></div>
                  <h3 className="font-bold text-gray-500 text-sm">Pedidos</h3>
                </div>
                <span className="text-3xl font-black text-gray-800">{dashboardMetrics.pedidos}</span>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center mb-2">
                  <div className="p-2 bg-green-50 rounded-lg text-green-500 mr-3"><CheckCircle size={20}/></div>
                  <h3 className="font-bold text-gray-500 text-sm">Entregues</h3>
                </div>
                <span className="text-3xl font-black text-gray-800">{dashboardMetrics.entregues}</span>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <div className="flex items-center mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500 mr-3"><DollarSign size={20}/></div>
                  <h3 className="font-bold text-gray-500 text-sm">Faturamento</h3>
                </div>
                <span className="text-2xl font-black text-gray-800">R$ {dashboardMetrics.faturamento.toFixed(2)}</span>
              </div>

              <div className="bg-gradient-to-br from-brand-primary to-emerald-600 p-6 rounded-2xl shadow-md border border-brand-primary flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10"><Percent size={100} /></div>
                <div className="flex items-center mb-2 relative z-10">
                  <div className="p-2 bg-white/20 rounded-lg text-white mr-3"><Percent size={20}/></div>
                  <h3 className="font-bold text-emerald-50 text-sm">Comissão do App</h3>
                </div>
                <span className="text-2xl font-black text-white relative z-10">R$ {dashboardMetrics.comissao.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div><h3 className="font-bold text-lg text-gray-800 flex items-center mb-1"><Bike size={20} className="mr-2 text-brand-secondary"/> Motoboys</h3><p className="text-sm text-gray-500">Online agora na plataforma</p></div>
                <span className="text-4xl font-black text-gray-800">{dashboardMetrics.motoboysOnline}</span>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div><h3 className="font-bold text-lg text-gray-800 flex items-center mb-1"><Store size={20} className="mr-2 text-orange-500"/> Lojas</h3><p className="text-sm text-gray-500">Abertas no momento</p></div>
                <span className="text-4xl font-black text-gray-800">{dashboardMetrics.lojasAbertas}</span>
              </div>
            </div>

            {/* SEÇÃO: ANÁLISE DE DESEMPENHO POR LOJA */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="mb-6">
                <h3 className="text-2xl font-black text-gray-800 flex items-center"><BarChart3 className="mr-2 text-brand-primary" /> Desempenho por Loja</h3>
                <p className="text-sm text-gray-500 mt-1">Analise o faturamento e comissões detalhadas com base nos filtros selecionados acima.</p>
              </div>

              {analysisLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-primary" size={32}/></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center"><ShoppingBag size={14} className="mr-1"/> Pedidos Totais</p>
                      <p className="text-2xl font-black text-gray-800">{analysisOrders.length}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center"><CheckCircle size={14} className="mr-1"/> Entregues</p>
                      <p className="text-2xl font-black text-green-600">{analysisEntregues.length}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center"><DollarSign size={14} className="mr-1"/> Faturamento</p>
                      <p className="text-2xl font-black text-gray-800">R$ {analysisFaturamento.toFixed(2)}</p>
                    </div>
                    <div className="bg-brand-light p-5 rounded-2xl shadow-sm border border-brand-primary/20">
                      <p className="text-xs text-brand-dark font-bold uppercase tracking-wider mb-1 flex items-center"><Percent size={14} className="mr-1"/> Comissão Gerada</p>
                      <p className="text-2xl font-black text-brand-primary">R$ {analysisComissao.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                      <h4 className="font-bold text-gray-700">Lista de Pedidos do Período</h4>
                      <span className="text-xs text-gray-500 font-medium">Mostrando {Math.min(analysisOrders.length, 50)} de {analysisOrders.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                            <th className="p-4 font-medium">#ID</th>
                            <th className="p-4 font-medium">Cliente</th>
                            <th className="p-4 font-medium">Loja</th>
                            <th className="p-4 font-medium">Total</th>
                            <th className="p-4 font-medium">Pagamento</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Horário</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {analysisOrders.slice(0, 50).map(order => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="p-4 font-bold text-gray-400">#{order.id}</td>
                              <td className="p-4 font-bold text-gray-800">{order.users?.name}</td>
                              <td className="p-4 text-gray-600">{order.stores?.name}</td>
                              <td className="p-4 font-bold text-gray-800">R$ {order.total.toFixed(2)}</td>
                              <td className="p-4">
                                {order.payment_method === 'cash' ? (
                                  <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Dinheiro</span>
                                ) : order.payment_method === 'pix' ? (
                                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">PIX</span>
                                ) : (
                                  <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-1 rounded">Cartão</span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`text-sm font-medium ${order.status === 'cancelled' ? 'text-red-500' : 'text-gray-600'}`}>
                                  {translateStatus(order.status)}
                                </span>
                                {order.status === 'cancelled' && order.cancel_reason && (
                                  <p className="text-[10px] text-red-400 mt-0.5 leading-tight">Motivo: {order.cancel_reason}</p>
                                )}
                              </td>
                              <td className="p-4 text-sm text-gray-500">{formatTime(order.created_at)}</td>
                            </tr>
                          ))}
                          {analysisOrders.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum pedido encontrado para esta seleção.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* NOTIFICAÇÕES */}
        {activeTab === 'notifications' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Notificações</h2>
                <p className="text-gray-500 text-sm mt-1">Dispare, agende e repita notificações para seus usuários.</p>
              </div>
              <button
                onClick={() => setShowNotifModal(true)}
                className="px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm shadow-sm hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <BellRing size={16} /> Nova Notificação
              </button>
            </div>

            {/* Histórico */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Histórico de Envios</h3>
              </div>
              {notifLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-primary" size={24} /></div>
              ) : notifications.length === 0 ? (
                <p className="p-6 text-center text-gray-400 text-sm">Nenhuma notificação enviada ainda</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm">{n.title}</p>
                          <p className="text-gray-500 text-sm mt-0.5">{n.body}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                              {n.target_type === 'all' ? '👥 Todos' : n.target_type === 'clients' ? '🛒 Clientes' : n.target_type === 'city' ? `📍 ${n.target_city}` : n.target_type === 'couriers' ? '🏍️ Motoboys' : '🏪 Lojas'}
                            </span>
                            {n.stores?.name && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">🏪 {n.stores.name}</span>
                            )}
                            {n.repeat_type && (
                              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                                🔁 {n.repeat_type === 'daily' ? 'Diário' : 'Semanal'}
                              </span>
                            )}
                            {n.scheduled_at && n.status === 'scheduled' && (
                              <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
                                ⏰ {new Date(n.scheduled_at).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            n.status === 'sent' ? 'bg-green-100 text-green-700' :
                            n.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                            n.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {n.status === 'sent' ? `✅ Enviado (${n.sent_count})` : n.status === 'scheduled' ? '⏰ Agendado' : n.status === 'failed' ? '❌ Falhou' : '⏳ Pendente'}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal de nova notificação */}
            {showNotifModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-xl font-black text-gray-800">Nova Notificação</h2>
                    <button onClick={() => setShowNotifModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Título</label>
                      <input
                        type="text" maxLength={50} placeholder="Ex: 🔥 Promoção especial hoje!"
                        value={notifForm.title}
                        onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Mensagem</label>
                      <textarea
                        rows={3} maxLength={150} placeholder="Ex: Use o cupom PROMO10 e ganhe 10% de desconto!"
                        value={notifForm.body}
                        onChange={e => setNotifForm(p => ({ ...p, body: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Destinatários</label>
                      <select
                        value={notifForm.targetType}
                        onChange={e => setNotifForm(p => ({ ...p, targetType: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      >
                        <option value="all">👥 Todos os usuários</option>
                        <option value="clients">🛒 Só clientes</option>
                        <option value="couriers">🏍️ Só motoboys</option>
                        <option value="stores">🏪 Só lojas</option>
                        <option value="city">📍 Por cidade</option>
                      </select>
                    </div>

                    {notifForm.targetType === 'city' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Cidade</label>
                        <input
                          type="text" placeholder="Ex: Alfenas"
                          value={notifForm.targetCity}
                          onChange={e => setNotifForm(p => ({ ...p, targetCity: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Agendar para (opcional)</label>
                      <input
                        type="datetime-local"
                        value={notifForm.scheduledAt}
                        onChange={e => setNotifForm(p => ({ ...p, scheduledAt: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">Deixe em branco para enviar agora</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Repetição</label>
                      <select
                        value={notifForm.repeatType}
                        onChange={e => setNotifForm(p => ({ ...p, repeatType: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      >
                        <option value="">Sem repetição</option>
                        <option value="daily">🔁 Diário</option>
                        <option value="weekly">📅 Semanal</option>
                      </select>
                    </div>

                    {notifForm.repeatType === 'weekly' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Dia da semana</label>
                        <select
                          value={notifForm.repeatDay}
                          onChange={e => setNotifForm(p => ({ ...p, repeatDay: parseInt(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                        >
                          <option value={0}>Domingo</option>
                          <option value={1}>Segunda-feira</option>
                          <option value={2}>Terça-feira</option>
                          <option value={3}>Quarta-feira</option>
                          <option value={4}>Quinta-feira</option>
                          <option value={5}>Sexta-feira</option>
                          <option value={6}>Sábado</option>
                        </select>
                      </div>
                    )}

                    {notifForm.repeatType && (
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Horário do envio</label>
                        <input
                          type="number" min={0} max={23}
                          value={notifForm.repeatHour}
                          onChange={e => setNotifForm(p => ({ ...p, repeatHour: parseInt(e.target.value) }))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowNotifModal(false)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSendNotification}
                      disabled={sendingNotif || !notifForm.title || !notifForm.body}
                      className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {sendingNotif ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
                      {notifForm.scheduledAt ? 'Agendar' : 'Enviar agora'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PEDIDOS (ADMIN) */}
        {activeTab === 'orders' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-800">Gestão de Pedidos</h2>
              <div className="flex space-x-4">
                <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary">
                  <option value="all">Todos os Status</option>
                  <option value="pending">Pendente</option>
                  <option value="preparing">Em Preparo</option>
                  <option value="ready">Pronto</option>
                  <option value="delivering">Em Rota</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <select value={orderDateFilter} onChange={e => setOrderDateFilter(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary">
                  <option value="today">Hoje</option>
                  <option value="yesterday">Ontem</option>
                  <option value="week">Últimos 7 dias</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-medium">#ID</th>
                    <th className="p-4 font-medium">Cliente / Loja</th>
                    <th className="p-4 font-medium">Motoboy</th>
                    <th className="p-4 font-medium">Total / Pgto</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Data/Hora</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-400">#{order.id}</td>
                      <td className="p-4">
                        <p className="font-bold text-gray-800">{order.users?.name}</p>
                        <p className="text-xs text-gray-500">Loja: {order.stores?.name}</p>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {order.own_delivery ? (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center w-fit"><User size={12} className="mr-1"/> Própria</span>
                        ) : (
                          order.couriers?.users?.name || '-'
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-800">R$ {order.total.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{order.payment_method === 'cash' ? '💵 Dinheiro' : order.payment_method === 'pix' ? '📱 PIX' : '💳 Cartão'}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm font-medium ${order.status === 'cancelled' ? 'text-red-500' : 'text-gray-600'}`}>
                          {translateStatus(order.status)}
                        </span>
                        {order.status === 'cancelled' && order.cancel_reason && (
                          <p className="text-[10px] text-red-400 mt-0.5 leading-tight">Motivo: {order.cancel_reason}</p>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')} {formatTime(order.created_at)}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => setViewOrder(order)} className="p-2 text-gray-600 bg-gray-100 rounded-xl flex items-center text-xs font-bold px-3 hover:bg-gray-200 shadow-sm transition-colors ml-auto"><Eye size={16} className="mr-1"/> Detalhes</button>
                      </td>
                    </tr>
                  ))}
                  {adminOrders.length === 0 && !loading && <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum pedido encontrado com estes filtros.</td></tr>}
                </tbody>
              </table>
              {ordersHasMore && adminOrders.length > 0 && (
                <div className="flex justify-center my-6">
                  <button
                    onClick={() => {
                      const next = ordersPage + 1;
                      setOrdersPage(next);
                      fetchAdminOrders(next, true);
                    }}
                    disabled={loading}
                    className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    Carregar mais pedidos
                  </button>
                </div>
              )}
              {!ordersHasMore && adminOrders.length > 0 && (
                <p className="text-center text-gray-400 text-sm mt-6 pb-4">Todos os pedidos foram carregados.</p>
              )}
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {activeTab === 'clients' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-black text-gray-800 mb-6">Gestão de Clientes</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-medium">Nome</th>
                    <th className="p-4 font-medium">E-mail</th>
                    <th className="p-4 font-medium">Telefone</th>
                    <th className="p-4 font-medium">Data de Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-800">{client.name}</td>
                      <td className="p-4 text-gray-600">{client.email}</td>
                      <td className="p-4 text-gray-600">{client.phone || '-'}</td>
                      <td className="p-4 text-sm text-gray-500">{new Date(client.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum cliente encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOJAS */}
        {activeTab === 'stores' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-800">Gestão de Lojas</h2>
              <div className="flex bg-gray-200 p-1 rounded-xl">
                <button onClick={() => setStoreFilter('pending')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${storeFilter === 'pending' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Em Análise ({pendingStoresCount})</button>
                <button onClick={() => setStoreFilter('approved')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${storeFilter === 'approved' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Aprovadas ({approvedStoresCount})</button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-medium">Loja / CNPJ</th>
                    <th className="p-4 font-medium">Responsável</th>
                    <th className="p-4 font-medium">Comissão</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStores.map(store => (
                    <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-gray-800">{store.name}</p>
                        <p className="text-xs text-gray-500">CNPJ: {store.cnpj || 'Não informado'}</p>
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        <p className="font-medium">{store.users?.name || 'Não informado'}</p>
                        <p className="text-xs">{store.users?.email}</p>
                      </td>
                      <td className="p-4 font-bold text-brand-primary">
                        {store.commission_rate || 0}%
                      </td>
                      <td className="p-4">
                        {isStoreApproved(store) ? <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Aprovada</span> : <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Em Análise</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => { setViewStore(store); setEditCommission(store.commission_rate?.toString() || '0'); }} className="p-2 text-gray-600 bg-gray-100 rounded-xl flex items-center text-xs font-bold px-3 hover:bg-gray-200 shadow-sm transition-colors"><Eye size={16} className="mr-1"/> Detalhes</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStores.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhuma loja encontrada nesta categoria.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MOTOBOYS */}
        {activeTab === 'couriers' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-800">Gestão de Motoboys</h2>
              <div className="flex bg-gray-200 p-1 rounded-xl">
                <button onClick={() => setCourierFilter('pending')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${courierFilter === 'pending' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Em Análise ({pendingCouriersCount})</button>
                <button onClick={() => setCourierFilter('approved')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${courierFilter === 'approved' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Aprovados ({approvedCouriersCount})</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-medium">Motoboy / CPF</th>
                    <th className="p-4 font-medium">Veículo / Placa</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCouriers.map(courier => (
                    <tr key={courier.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center space-x-3">
                        {courier.users?.avatar_url ? (
                          <img src={courier.users.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400"><User size={20}/></div>
                        )}
                        <div>
                          <p className="font-bold text-gray-800">{courier.users?.name || 'Não informado'}</p>
                          <p className="text-xs text-gray-500">CPF: {courier.cpf}</p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        <p className="font-medium capitalize">{courier.vehicle_type === 'motorcycle' ? 'Moto' : courier.vehicle_type === 'bicycle' ? 'Bicicleta' : 'Carro'} {courier.vehicle_brand ? `- ${courier.vehicle_brand}` : ''}</p>
                        <p className="text-xs">{courier.license_plate || 'Sem placa'}</p>
                      </td>
                      <td className="p-4">
                        {isCourierApproved(courier) ? <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Aprovado</span> : <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Em Análise</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => openCourierDetails(courier)} className="p-2 text-gray-600 bg-gray-100 rounded-xl flex items-center text-xs font-bold px-3 hover:bg-gray-200 shadow-sm transition-colors"><Eye size={16} className="mr-1"/> Detalhes</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCouriers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum motoboy encontrado nesta categoria.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CUPONS GLOBAIS */}
        {activeTab === 'coupons' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-800">Cupons da Plataforma</h2>
              <div className="flex items-center gap-3">
                <select
                  value={couponStoreFilter}
                  onChange={e => setCouponStoreFilter(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-primary outline-none"
                >
                  <option value="all">Todas as lojas</option>
                  {[...new Map(allCoupons.map(c => [c.store_id, c.stores?.name])).entries()].map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-medium">Código</th>
                    <th className="p-4 font-medium">Loja</th>
                    <th className="p-4 font-medium">Desconto</th>
                    <th className="p-4 font-medium">Mínimo</th>
                    <th className="p-4 font-medium">Validade</th>
                    <th className="p-4 font-medium">Usos (máx.)</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allCoupons
                    .filter(c => couponStoreFilter === 'all' || c.store_id.toString() === couponStoreFilter)
                    .map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-4 font-black text-brand-dark tracking-wider">{c.code}</td>
                        <td className="p-4 text-gray-600 text-sm font-medium">{c.stores?.name}</td>
                        <td className="p-4 font-bold text-green-600">
                          {c.type === 'percentage' ? `${c.value}%` : `R$ ${c.value.toFixed(2)}`}
                        </td>
                        <td className="p-4 text-gray-500 text-sm">
                          {c.min_order_value > 0 ? `R$ ${c.min_order_value.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}
                        </td>
                        <td className="p-4 text-sm text-gray-500">
                          {c.max_uses ?? '∞'}
                        </td>
                        <td className="p-4">
                          {c.is_active
                            ? <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Ativo</span>
                            : <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">Inativo</span>
                          }
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center space-x-2">
                            <button onClick={() => toggleCouponStatus(c)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${c.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                              {c.is_active ? 'Pausar' : 'Ativar'}
                            </button>
                            <button onClick={() => handleDeleteCoupon(c.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Excluir Cupom"><Trash2 size={18}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {allCoupons.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-gray-500">Nenhum cupom criado ainda.</td>
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
              <h2 className="text-2xl font-black text-gray-800">Avaliações dos Clientes</h2>
              <div className="flex bg-gray-200 p-1 rounded-xl">
                {['all', '5', '4', '3', '2', '1'].map(r => (
                  <button
                    key={r}
                    onClick={() => setReviewRatingFilter(r)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${reviewRatingFilter === r ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {r === 'all' ? 'Todas' : `${'⭐'.repeat(parseInt(r))}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Métricas rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[5,4,3,2,1].map(star => {
                const count = allReviews.filter(r => r.rating === star).length;
                const pct = allReviews.length > 0 ? Math.round((count / allReviews.length) * 100) : 0;
                return (
                  <div key={star} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
                    <p className="text-2xl font-black text-brand-dark">{count}</p>
                    <p className="text-sm text-gray-500 mt-1">{'⭐'.repeat(star)}</p>
                    <p className="text-xs text-gray-400 mt-1">{pct}%</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              {allReviews
                .filter(r => reviewRatingFilter === 'all' || r.rating === parseInt(reviewRatingFilter))
                .map(review => (
                  <div key={review.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-light text-brand-primary rounded-full flex items-center justify-center font-black text-lg">
                          {review.users?.name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="font-bold text-brand-dark">{review.users?.name || 'Cliente'}</p>
                          <p className="text-xs text-gray-400">{review.orders?.stores?.name || 'Loja'}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <div className="flex items-center justify-end gap-0.5 mb-1">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-lg ${s <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                          ))}
                        </div>
                        <div className="flex items-center space-x-3">
                          <p className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString('pt-BR')}</p>
                          <button onClick={() => handleDeleteReview(review.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Excluir Avaliação">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-xl italic">"{review.comment}"</p>
                    )}
                  </div>
                ))}
              {allReviews.length === 0 && (
                <div className="bg-white p-12 rounded-2xl text-center text-gray-500">
                  Nenhuma avaliação recebida ainda.
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPASSES */}
        {activeTab === 'repasses' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Repasses da Semana</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Valores acumulados desde segunda-feira. Transferência automática via Asaas toda segunda-feira.
                </p>
              </div>
              <button
                onClick={fetchRepasses}
                disabled={repassesLoading}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                {repassesLoading ? <Loader2 size={16} className="animate-spin" /> : '↻'} Atualizar
              </button>
            </div>

            {/* Cards de totais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total para Lojas</p>
                <p className="text-3xl font-black text-brand-primary">R$ {repassesTotal.stores.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total para Motoboys</p>
                <p className="text-3xl font-black text-brand-primary">R$ {repassesTotal.couriers.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-brand-primary to-green-600 p-6 rounded-2xl shadow-sm">
                <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Comissão da Plataforma</p>
                <p className="text-3xl font-black text-white">R$ {repassesTotal.platform.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lojas */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <Store size={18} className="text-brand-primary" />
                  <h3 className="font-bold text-gray-800">Lojas Parceiras</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-bold">
                    {storeRepasses.length}
                  </span>
                </div>
                {repassesLoading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-primary" size={24} /></div>
                ) : storeRepasses.length === 0 ? (
                  <p className="p-6 text-center text-gray-400 text-sm">Nenhum repasse esta semana</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {storeRepasses.map((s, i) => (
                      <div key={i} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{s.name}</p>
                          {s.walletId && (
                            <p className="text-xs text-gray-400 mt-0.5">Wallet: {s.walletId.slice(0, 12)}...</p>
                          )}
                        </div>
                        <span className="font-black text-brand-primary">R$ {s.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Motoboys */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <Bike size={18} className="text-brand-primary" />
                  <h3 className="font-bold text-gray-800">Motoboys</h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-bold">
                    {courierRepasses.length}
                  </span>
                </div>
                {repassesLoading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-primary" size={24} /></div>
                ) : courierRepasses.length === 0 ? (
                  <p className="p-6 text-center text-gray-400 text-sm">Nenhum repasse esta semana</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {courierRepasses.map((c, i) => (
                      <div key={i} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                          {c.walletId && (
                            <p className="text-xs text-gray-400 mt-0.5">Wallet: {c.walletId.slice(0, 12)}...</p>
                          )}
                        </div>
                        <span className="font-black text-brand-primary">R$ {c.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DETALHES PEDIDO */}
      {viewOrder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-2xl font-black text-brand-dark flex items-center"><ShoppingBag className="mr-2 text-brand-primary" /> Pedido #{viewOrder.id}</h2>
                <p className="text-sm text-gray-500 mt-1">{new Date(viewOrder.created_at).toLocaleDateString('pt-BR')} às {formatTime(viewOrder.created_at)}</p>
              </div>
              <button onClick={() => setViewOrder(null)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Cliente</p>
                  <p className="font-bold text-gray-800">{viewOrder.users?.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-1">Loja</p>
                  <p className="font-bold text-gray-800">{viewOrder.stores?.name}</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center"><MapPin size={18} className="mr-2 text-gray-400"/> Endereço de Entrega</h3>
                {viewOrder.addresses ? (
                  <div className="text-sm text-gray-700">
                    <p>{viewOrder.addresses.street}, {viewOrder.addresses.number} {viewOrder.addresses.complement ? `- ${viewOrder.addresses.complement}` : ''}</p>
                    <p>{viewOrder.addresses.neighborhood} - {viewOrder.addresses.city}/{viewOrder.addresses.state}</p>
                  </div>
                ) : <p className="text-sm text-gray-500">Não informado</p>}
              </div>

              <div>
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center"><Package size={18} className="mr-2 text-gray-400"/> Itens do Pedido</h3>
                <div className="space-y-2">
                  {viewOrder.order_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-700">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="font-medium">R$ {item.total_price.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm text-gray-500 pt-2 border-t border-gray-100">
                    <span>Subtotal</span><span>R$ {viewOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Taxa de entrega</span><span>R$ {viewOrder.delivery_fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-brand-dark pt-2">
                    <span>Total</span><span>R$ {viewOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center"><CreditCard size={18} className="mr-2 text-gray-400"/> Pagamento</h3>
                  <p className="text-sm font-bold text-gray-800">{viewOrder.payment_method === 'cash' ? '💵 Dinheiro' : viewOrder.payment_method === 'pix' ? '📱 PIX' : '💳 Cartão'}</p>
                  {viewOrder.payment_method === 'cash' && viewOrder.change_for && (
                    <p className="text-xs text-gray-500 mt-1">Troco para R$ {viewOrder.change_for.toFixed(2)}</p>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 border-b pb-2 mb-3 flex items-center"><CheckCircle size={18} className="mr-2 text-gray-400"/> Status Atual</h3>
                  <p className={`text-sm font-bold ${viewOrder.status === 'cancelled' ? 'text-red-500' : 'text-brand-primary'}`}>
                    {translateStatus(viewOrder.status)}
                  </p>
                  {viewOrder.status === 'cancelled' && viewOrder.cancel_reason && (
                    <p className="text-xs text-red-400 mt-1 font-medium">Motivo: {viewOrder.cancel_reason}</p>
                  )}
                  {viewOrder.own_delivery ? (
                    <p className="text-xs text-purple-600 mt-1 flex items-center font-bold"><User size={12} className="mr-1"/> Entrega Própria da Loja</p>
                  ) : viewOrder.couriers ? (
                    <p className="text-xs text-gray-500 mt-1 flex items-center"><Bike size={12} className="mr-1"/> {viewOrder.couriers.users?.name}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES LOJA */}
      {viewStore && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-2xl font-black text-brand-dark flex items-center"><Store className="mr-2 text-brand-primary" /> Detalhes da Loja</h2>
                <p className="text-sm text-gray-500 mt-1">ID: {viewStore.id} • Cadastrado em: {new Date(viewStore.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => setViewStore(null)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center"><FileText size={18} className="mr-2 text-gray-400"/> Dados do Negócio</h3>
                  <div><p className="text-xs text-gray-500">Nome da Loja</p><p className="font-semibold text-gray-800">{viewStore.name}</p></div>
                  <div><p className="text-xs text-gray-500">CNPJ</p><p className="font-semibold text-gray-800">{viewStore.cnpj || 'Não informado'}</p></div>
                  <div><p className="text-xs text-gray-500">Responsável</p><p className="font-semibold text-gray-800">{viewStore.users?.name}</p></div>
                  <div><p className="text-xs text-gray-500">E-mail</p><p className="font-semibold text-gray-800">{viewStore.users?.email}</p></div>
                  <div><p className="text-xs text-gray-500">Telefone</p><p className="font-semibold text-gray-800">{viewStore.users?.phone || viewStore.phone || 'Não informado'}</p></div>
                  <div><p className="text-xs text-gray-500">Descrição</p><p className="text-sm text-gray-700">{viewStore.description || 'Sem descrição'}</p></div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center"><Clock size={18} className="mr-2 text-gray-400"/> Operação e Taxas</h3>
                  <div><p className="text-xs text-gray-500">Tempo Médio de Preparo</p><p className="font-semibold text-gray-800">{viewStore.avg_prep_time_min} minutos</p></div>
                  <div><p className="text-xs text-gray-500">Pedido Mínimo</p><p className="font-semibold text-gray-800">R$ {viewStore.min_order_value?.toFixed(2)}</p></div>
                  <div><p className="text-xs text-gray-500">Taxa Base de Entrega</p><p className="font-semibold text-gray-800">R$ {viewStore.delivery_fee?.toFixed(2)}</p></div>
                  
                  <div className="bg-brand-light p-4 rounded-xl border border-brand-primary/20 mt-4">
                    <label className="block text-xs text-brand-dark font-bold mb-1">Comissão do App (%)</label>
                    <div className="flex space-x-2">
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0" 
                        max="100" 
                        value={editCommission} 
                        onChange={e => setEditCommission(e.target.value)} 
                        className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                      />
                      <button onClick={handleUpdateCommission} className="bg-brand-primary text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-600 transition-colors">Salvar</button>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-800 border-b pb-2 mt-6 flex items-center"><CreditCard size={18} className="mr-2 text-gray-400"/> Pagamentos Aceitos</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewStore.accepts_pix && <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">PIX</span>}
                    {viewStore.accepts_card && <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">Cartão</span>}
                    {viewStore.accepts_cash && <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-600">Dinheiro</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center"><MapPin size={18} className="mr-2 text-gray-400"/> Endereço</h3>
                {viewStore.addresses ? (
                  <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700">
                    <p>{viewStore.addresses.street}, {viewStore.addresses.number} {viewStore.addresses.complement ? `- ${viewStore.addresses.complement}` : ''}</p>
                    <p>{viewStore.addresses.neighborhood} - {viewStore.addresses.city}/{viewStore.addresses.state}</p>
                    <p>CEP: {viewStore.addresses.zip_code}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Endereço não cadastrado.</p>
                )}
              </div>
            </div>

            {!viewStore.is_approved && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-4 shrink-0">
                <button onClick={() => handleRejectStore(viewStore.id, viewStore.owner_id)} className="px-6 py-3 text-red-600 bg-red-100 hover:bg-red-200 rounded-xl font-bold flex items-center transition-colors"><XCircle size={20} className="mr-2"/> Recusar e Excluir</button>
                <button onClick={() => handleApproveStore(viewStore.id, viewStore.owner_id)} className="px-8 py-3 text-white bg-brand-primary hover:bg-green-600 rounded-xl font-bold flex items-center shadow-lg transition-colors"><CheckCircle size={20} className="mr-2"/> Aprovar Loja</button>
              </div>
            )}
            {viewStore.is_approved && !viewStore.asaas_wallet_id && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                <button
                  onClick={async () => {
                    setLoading(true);
                    const { data: result, error } = await supabase.functions.invoke('create-asaas-account', {
                      body: { entityType: 'store', entityId: viewStore.id }
                    });
                    setLoading(false);
                    if (error || !result?.success) {
                      const asaasMessage = result?.error || await extractEdgeFunctionErrorMessage(error);
                      showToast(`Erro ao criar conta Asaas: ${asaasMessage}`, 'error');
                    } else {
                      showToast('Conta de pagamentos criada com sucesso!');
                      fetchData();
                      setViewStore(null);
                    }
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  ⚠️ Criar conta de pagamentos (Asaas)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALHES MOTOBOY */}
      {viewCourier && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
              <div className="flex items-center space-x-4">
                {viewCourier.users?.avatar_url ? (
                  <img src={viewCourier.users.avatar_url} alt="Foto" className="w-16 h-16 rounded-full object-cover border-2 border-brand-secondary shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 border-2 border-gray-300">
                    <User size={32} />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-black text-brand-dark flex items-center">{viewCourier.users?.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">ID: {viewCourier.id} • Cadastrado em: {new Date(viewCourier.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <button onClick={() => setViewCourier(null)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* FOTO DE VERIFICAÇÃO (SELFIE) */}
              <div className="flex flex-col items-center bg-gray-50 py-6 rounded-2xl border border-gray-100 mb-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Selfie de Verificação</p>
                {viewCourier.users?.avatar_url ? (
                  <a href={viewCourier.users.avatar_url} target="_blank" rel="noopener noreferrer" className="relative group cursor-pointer block" title="Clique para ampliar">
                    <img src={viewCourier.users.avatar_url} alt="Selfie do Motoboy" className="w-48 h-48 rounded-2xl object-cover border-4 border-white shadow-lg group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-bold text-sm flex items-center"><Search size={16} className="mr-2"/> Ampliar</span>
                    </div>
                  </a>
                ) : (
                  <div className="w-48 h-48 rounded-2xl bg-white border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 shadow-sm">
                    <User size={48} className="mb-3 opacity-50" />
                    <span className="text-sm font-medium">Foto não enviada</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center"><FileText size={18} className="mr-2 text-gray-400"/> Dados Pessoais</h3>
                  <div><p className="text-xs text-gray-500">Nome Completo</p><p className="font-semibold text-gray-800">{viewCourier.users?.name}</p></div>
                  <div><p className="text-xs text-gray-500">CPF</p><p className="font-semibold text-gray-800">{viewCourier.cpf}</p></div>
                  <div><p className="text-xs text-gray-500">E-mail</p><p className="font-semibold text-gray-800">{viewCourier.users?.email}</p></div>
                  <div><p className="text-xs text-gray-500">Telefone</p><p className="font-semibold text-gray-800">{viewCourier.users?.phone || 'Não informado'}</p></div>
                  <div><p className="text-xs text-gray-500">Cidade de Atuação</p><p className="font-semibold text-gray-800">{viewCourier.operation_city || 'Não informada'}</p></div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center"><Bike size={18} className="mr-2 text-gray-400"/> Veículo & Financeiro</h3>
                  <div><p className="text-xs text-gray-500">Tipo de Veículo</p><p className="font-semibold text-gray-800 capitalize">{viewCourier.vehicle_type === 'motorcycle' ? 'Moto' : viewCourier.vehicle_type === 'bicycle' ? 'Bicicleta' : 'Carro'}</p></div>
                  {viewCourier.vehicle_type !== 'bicycle' && (
                    <>
                      <div><p className="text-xs text-gray-500">Marca / Modelo</p><p className="font-semibold text-gray-800">{viewCourier.vehicle_brand || '-'} / {viewCourier.vehicle_model || '-'}</p></div>
                      <div><p className="text-xs text-gray-500">Ano</p><p className="font-semibold text-gray-800">{viewCourier.vehicle_year || '-'}</p></div>
                      <div><p className="text-xs text-gray-500">Placa</p><p className="font-semibold text-gray-800 uppercase">{viewCourier.license_plate || '-'}</p></div>
                    </>
                  )}
                  <div className="mt-4"><p className="text-xs text-gray-500 flex items-center"><DollarSign size={14} className="mr-1"/> Chave PIX</p><p className="font-bold text-brand-primary bg-brand-light p-2 rounded-lg mt-1">{viewCourier.pix_key || 'Não informada'}</p></div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center"><MapPin size={18} className="mr-2 text-gray-400"/> Endereço Residencial</h3>
                {viewCourier.address ? (
                  <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700">
                    <p>{viewCourier.address.street}, {viewCourier.address.number} {viewCourier.address.complement ? `- ${viewCourier.address.complement}` : ''}</p>
                    <p>{viewCourier.address.neighborhood} - {viewCourier.address.city}/{viewCourier.address.state}</p>
                    <p>CEP: {viewCourier.address.zip_code}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Endereço não cadastrado.</p>
                )}
              </div>
            </div>

            {!viewCourier.is_approved && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-4 shrink-0">
                <button onClick={() => handleRejectCourier(viewCourier.id, viewCourier.user_id)} className="px-6 py-3 text-red-600 bg-red-100 hover:bg-red-200 rounded-xl font-bold flex items-center transition-colors"><XCircle size={20} className="mr-2"/> Recusar e Excluir</button>
                <button onClick={() => handleApproveCourier(viewCourier.id, viewCourier.user_id)} className="px-8 py-3 text-white bg-brand-primary hover:bg-green-600 rounded-xl font-bold flex items-center shadow-lg transition-colors"><CheckCircle size={20} className="mr-2"/> Aprovar Motoboy</button>
              </div>
            )}
            {viewCourier.is_approved && !viewCourier.asaas_wallet_id && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                <button
                  onClick={async () => {
                    setLoading(true);
                    const { data: result, error } = await supabase.functions.invoke('create-asaas-account', {
                      body: { entityType: 'courier', entityId: viewCourier.id }
                    });
                    setLoading(false);
                    if (error || !result?.success) {
                      const asaasMessage = result?.error || await extractEdgeFunctionErrorMessage(error);
                      showToast(`Erro ao criar conta Asaas: ${asaasMessage}`, 'error');
                    } else {
                      showToast('Conta de pagamentos criada com sucesso!');
                      fetchData();
                      setViewCourier(null);
                    }
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  ⚠️ Criar conta de pagamentos (Asaas)
                </button>
              </div>
            )}
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

    </div>
  );
}
