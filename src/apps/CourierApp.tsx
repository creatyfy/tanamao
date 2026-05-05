import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Power, MapPin, DollarSign, Navigation, CheckCircle, User, Store, Loader2, LogOut, AlertTriangle, CreditCard, Banknote, Bike, FileText, BellRing, Map, Trash2 } from 'lucide-react';

// Helper — detecta se está rodando dentro do app Capacitor nativo
const isNativeApp = () => !!(window as any).Capacitor?.isNativePlatform?.();

// Componente auxiliar para renderizar o mapa e os botões de navegação
const AddressMap = ({ address }: { address: string }) => {
  if (!address) return null;
  const encodedAddress = encodeURIComponent(address);
  
  return (
    <div className="mt-4 mb-6 shrink-0">
      {/* Mapa Embutido */}
      <div className="w-full h-48 rounded-2xl overflow-hidden border-2 border-gray-700 mb-3 shadow-inner relative bg-gray-800">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0, filter: 'contrast(0.9) opacity(0.9)' }}
          src={`https://maps.google.com/maps?q=${encodedAddress}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
          allowFullScreen
        ></iframe>
      </div>
      
      {/* Botões de Navegação Externa */}
      <div className="flex gap-3">
        <button 
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank')}
          className="flex-1 bg-gray-100 hover:bg-white text-gray-900 py-3 rounded-xl font-bold text-sm flex justify-center items-center transition-colors shadow-sm"
        >
          <Map size={16} className="mr-2" /> Google Maps
        </button>
        <button 
          onClick={() => window.open(`https://waze.com/ul?q=${encodedAddress}`, '_blank')}
          className="flex-1 bg-[#33ccff] hover:bg-[#2eb8e6] text-white py-3 rounded-xl font-bold text-sm flex justify-center items-center transition-colors shadow-sm"
        >
          <Navigation size={16} className="mr-2" /> Waze
        </button>
      </div>
    </div>
  );
};

export default function CourierApp({ onExit }: { onExit: () => void }) {
  const { user, deleteAccount } = useAuth();
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const { permission: notifPermission, requestPermission, sendNotification } = usePushNotifications();
  const [courier, setCourier] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => setToast({ message, type });
  
  const [deliveryState, setDeliveryState] = useState('none'); 
  const deliveryStateRef = React.useRef('none');
  useEffect(() => { deliveryStateRef.current = deliveryState; }, [deliveryState]);

  const [acceptTimer, setAcceptTimer] = useState(60);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const activeDeliveryRef = React.useRef<any>(null);
  useEffect(() => { activeDeliveryRef.current = activeDelivery; }, [activeDelivery]);

  const [gpsError, setGpsError] = useState(false);
  const watchIdRef = useRef<string | null>(null);
  
  // Delivery Code Validation
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const [deliveryCodeError, setDeliveryCodeError] = useState(false);

  // Earnings History
  const [deliveriesHistory, setDeliveriesHistory] = useState<any[]>([]);
  const [earningsPage, setEarningsPage] = useState(0);
  const [earningsHasMore, setEarningsHasMore] = useState(true);
  const EARNINGS_PAGE_SIZE = 20;

  // Perfil
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Ganhos por período
  const [earningsPeriod, setEarningsPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [periodEarnings, setPeriodEarnings] = useState(0);
  const [periodDeliveries, setPeriodDeliveries] = useState(0);

  useEffect(() => {
    if (user) fetchCourier();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'earnings' && courier) {
      setEarningsPage(0);
      setDeliveriesHistory([]);
      setEarningsHasMore(true);
      fetchEarningsHistory(0, false);
    }
  }, [activeTab, courier]);

  useEffect(() => {
    if (deliveriesHistory.length > 0) {
      calcPeriodEarnings(earningsPeriod);
    } else {
      setPeriodDeliveries(0);
      setPeriodEarnings(0);
    }
  }, [deliveriesHistory, earningsPeriod]);

  const fetchCourier = async () => {
    try {
      const { data } = await supabase.from('couriers').select('*, users:user_id(*)').eq('user_id', user!.id).maybeSingle();
      if (data) {
        setCourier(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // POLING DE CORRIDAS PENDENTES
  const checkPendingOffers = async () => {
    if (deliveryStateRef.current !== 'none') return;
    
    try {
      // Busca a oferta MAIS RECENTE com dados da loja para filtrar por cidade
      const { data: delivery } = await supabase
        .from('deliveries')
        .select('*, orders(store_id, stores(name, addresses(city)))')
        .eq('status', 'offered')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (delivery) {
        // Ignora corridas muito antigas (mais de 65 segundos)
        const elapsed = Date.now() - new Date(delivery.created_at).getTime();
        if (elapsed > 65000) return;

        // Filtro por cidade — compara cidade da loja com última posição do motoboy
        const storeCity = (delivery as any).orders?.stores?.addresses?.city;
        if (storeCity && courier?.last_lat && courier?.last_lng) {
          // Busca cidade do motoboy via geocoding reverso da última posição conhecida
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${courier.last_lat}&lon=${courier.last_lng}&format=json&accept-language=pt-BR`
            );
            const geo = await res.json();
            const courierCity = geo?.address?.city || geo?.address?.town || geo?.address?.village || '';
            if (courierCity && storeCity.toLowerCase() !== courierCity.toLowerCase()) {
              return; // Motoboy em cidade diferente — ignora a corrida
            }
          } catch {
            // Se geocoding falhar, não bloqueia — mostra a corrida normalmente
          }
        }

        const { data: order } = await supabase
          .from('orders')
          .select('*, stores(name, addresses(*)), addresses(*), users:client_id(name, phone), order_items(*)')
          .eq('id', delivery.order_id)
          .maybeSingle();

        if (order && deliveryStateRef.current === 'none') {
          setActiveDelivery({ ...delivery, order });
          setDeliveryState('offered');
          
          let timeLeft = 60 - Math.floor(elapsed / 1000);
          if (timeLeft < 1 || timeLeft > 60) timeLeft = 60;
          setAcceptTimer(timeLeft);

          sendNotification('🏍️ Nova Corrida Disponível!', {
            body: `Ganho de R$ ${delivery.courier_earning?.toFixed(2)}. Coleta em ${order.stores?.name}. Aceite rápido!`,
          });
          navigator.vibrate?.([300, 100, 300, 100, 300]);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar ofertas:', err);
    }
  };

  // Checa a cada 5 segundos se há corridas pendentes (Fallback robusto para o Realtime)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (courier?.is_online && deliveryState === 'none') {
      interval = setInterval(() => {
        checkPendingOffers();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [courier?.is_online, deliveryState]);

  const subscribeToDeliveries = (courierId: number) => {
    const channel = supabase.channel(`broadcast_offers_${courierId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries' }, () => {
        setTimeout(checkPendingOffers, 500);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries' }, (payload) => {
        const updated = payload.new;
        if (
          deliveryStateRef.current === 'offered' &&
          activeDeliveryRef.current?.id === updated.id &&
          updated.status !== 'offered' &&
          updated.courier_id !== courierId
        ) {
          showToast('Corrida aceita por outro motoboy ou cancelada pela loja.', 'warning');
          setDeliveryState('none');
          setActiveDelivery(null);
          setDeliveryCodeInput('');
          setDeliveryCodeError(false);
        }
      })
      .subscribe();

    return channel;
  };

  // Cleanup effect for Realtime channel
  useEffect(() => {
    let channel: any;
    if (courier?.is_online) {
      channel = subscribeToDeliveries(courier.id);
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [courier?.is_online]);

  const toggleOnline = async () => {
    if (!courier) return;

    if (!courier.is_online) {
      setLoading(true);
      setGpsError(false);
      try {
        if (isNativeApp()) {
          // App nativo — usa plugin Capacitor (pede popup nativo de permissão)
          const { Geolocation } = await import('@capacitor/geolocation');
          const permission = await Geolocation.requestPermissions();
          if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
            setGpsError(true);
            showToast('Permissão de localização negada. Vá em Configurações > Tá Na Mão > Localização.', 'error');
            setLoading(false);
            return;
          }
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          await supabase.from('couriers').update({
            is_online: true,
            last_lat: pos.coords.latitude,
            last_lng: pos.coords.longitude,
            location_at: new Date().toISOString()
          }).eq('id', courier.id);
        } else {
          // Web — usa navigator.geolocation
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) { reject(new Error('GPS não suportado')); return; }
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
          });
          await supabase.from('couriers').update({
            is_online: true,
            last_lat: pos.coords.latitude,
            last_lng: pos.coords.longitude,
            location_at: new Date().toISOString()
          }).eq('id', courier.id);
        }
        setCourier({ ...courier, is_online: true });
        showToast('Você está online! 🟢', 'success');
        setTimeout(checkPendingOffers, 1000);
      } catch (error: any) {
        console.warn('Erro GPS:', error);
        setGpsError(true);
        if (error.message?.includes('denied') || error.code === 1) {
          showToast('Permissão negada. Vá em Configurações > Tá Na Mão > Localização.', 'error');
        } else {
          showToast('Erro ao obter localização. Verifique se o GPS está ativo.', 'error');
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Desligar — para o watch
      if (watchIdRef.current) {
        if (isNativeApp()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } else {
          navigator.geolocation.clearWatch(Number(watchIdRef.current));
        }
        watchIdRef.current = null;
      }
      setLoading(true);
      try {
        await supabase.from('couriers').update({ is_online: false }).eq('id', courier.id);
        setCourier({ ...courier, is_online: false });
        showToast('Você está offline.', 'success');
      } catch (error) {
        showToast('Erro ao ficar offline.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchEarningsHistory = async (page = 0, append = false) => {
    setLoading(true);
    try {
      const from = page * EARNINGS_PAGE_SIZE;
      const to = from + EARNINGS_PAGE_SIZE - 1;
      const { data } = await supabase
        .from('deliveries')
        .select('*, orders(store_id, stores(name), created_at)')
        .eq('courier_id', courier.id)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
        .range(from, to);

      if (data) {
        setDeliveriesHistory(prev => append ? [...prev, ...data] : data);
        setEarningsHasMore(data.length === EARNINGS_PAGE_SIZE);
      }
    } catch (error) {
      showToast('Erro ao carregar histórico de entregas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calcPeriodEarnings = (period: 'today' | 'week' | 'month') => {
    const now = new Date();
    let start: Date;

    if (period === 'today') {
      start = new Date(now); start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start = new Date(now); start.setDate(now.getDate() - 7);
    } else {
      start = new Date(now); start.setDate(now.getDate() - 30);
    }

    const filtered = deliveriesHistory.filter(d => {
      const date = new Date(d.orders?.created_at);
      return date >= start;
    });

    setPeriodDeliveries(filtered.length);
    setPeriodEarnings(filtered.reduce((acc: number, d: any) => acc + (d.courier_earning || 0), 0));
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      showToast('Nome não pode ser vazio', 'warning');
      return;
    }
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: profileForm.name, phone: profileForm.phone })
        .eq('id', user!.id);

      if (error) throw error;

      setCourier((prev: any) => ({
        ...prev,
        users: { ...prev.users, name: profileForm.name, phone: profileForm.phone }
      }));
      setShowProfileEdit(false);
      showToast('Perfil atualizado!', 'success');
    } catch {
      showToast('Erro ao salvar perfil', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (deliveryState === 'offered' && acceptTimer > 0) {
      interval = setInterval(() => setAcceptTimer(prev => prev - 1), 1000);
    } else if (deliveryState === 'offered' && acceptTimer <= 0) {
      showToast('Tempo esgotado.', 'warning');
      setDeliveryState('none');
      setActiveDelivery(null);
      setDeliveryCodeInput('');
      setDeliveryCodeError(false);
    }
    return () => clearInterval(interval);
  }, [deliveryState, acceptTimer]);

  useEffect(() => {
    if (!courier?.is_online || !courier?.id) return;

    const startWatch = async () => {
      try {
        if (isNativeApp()) {
          // App nativo — usa plugin Capacitor
          const { Geolocation } = await import('@capacitor/geolocation');
          if (watchIdRef.current) {
            await Geolocation.clearWatch({ id: watchIdRef.current });
            watchIdRef.current = null;
          }
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 30000 },
            async (pos, err) => {
              if (err || !pos) { setGpsError(true); return; }
              setGpsError(false);
              await supabase.from('couriers').update({
                last_lat: pos.coords.latitude,
                last_lng: pos.coords.longitude,
                location_at: new Date().toISOString()
              }).eq('id', courier.id);
            }
          );
          watchIdRef.current = id;
        } else {
          // Web — usa navigator.geolocation
          if (!navigator.geolocation) return;
          const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
              setGpsError(false);
              await supabase.from('couriers').update({
                last_lat: pos.coords.latitude,
                last_lng: pos.coords.longitude,
                location_at: new Date().toISOString()
              }).eq('id', courier.id);
            },
            (err) => { console.warn('GPS watch error:', err); setGpsError(true); },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
          );
          watchIdRef.current = String(watchId);
        }
      } catch (err) {
        console.warn('Erro ao iniciar rastreamento:', err);
      }
    };

    startWatch();

    return () => {
      if (watchIdRef.current) {
        if (isNativeApp()) {
          import('@capacitor/geolocation').then(({ Geolocation }) => {
            Geolocation.clearWatch({ id: watchIdRef.current! });
          });
        } else {
          navigator.geolocation.clearWatch(Number(watchIdRef.current));
        }
        watchIdRef.current = null;
      }
    };
  }, [courier?.is_online, courier?.id]);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const { data: updated, error: delErr } = await supabase
        .from('deliveries')
        .update({
          status: 'going_to_store',
          courier_id: courier!.id,
          accepted_at: new Date().toISOString()
        })
        .eq('id', activeDelivery.id)
        .eq('status', 'offered')
        .select()
        .maybeSingle();

      if (delErr || !updated) {
        showToast('Corrida já foi aceita por outro motoboy.', 'warning');
        setDeliveryState('none');
        setActiveDelivery(null);
        return;
      }

      const { error: ordErr } = await supabase
        .from('orders')
        .update({ courier_id: courier!.id })
        .eq('id', activeDelivery.order_id);

      if (ordErr) throw ordErr;

      setDeliveryState('going_to_store');
      showToast('Corrida aceita! Siga para a loja.');
    } catch (e: any) {
      showToast('Erro ao aceitar corrida.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = () => {
    setDeliveryState('none');
    setActiveDelivery(null);
    setDeliveryCodeInput('');
    setDeliveryCodeError(false);
  };

  const handleArrivedStore = async () => {
    setActionLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'at_store', pickup_at: new Date().toISOString() }).eq('id', activeDelivery.id);
      setDeliveryState('at_store');
    } catch (e) { showToast('Erro ao atualizar status', 'error'); } finally { setActionLoading(false); }
  };

  const handlePickup = async () => {
    setActionLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'delivering' }).eq('id', activeDelivery.id);
      await supabase.from('orders').update({ status: 'delivering' }).eq('id', activeDelivery.order_id);
      setDeliveryState('going_to_client');
      showToast('Pedido retirado! Siga para o cliente.');
    } catch (e) { showToast('Erro ao atualizar status', 'error'); } finally { setActionLoading(false); }
  };

  const handleDelivered = async () => {
    if (activeDelivery.order.delivery_code && deliveryCodeInput.trim() !== activeDelivery.order.delivery_code) {
      setDeliveryCodeError(true);
      showToast('Código incorreto. Peça ao cliente o código de 4 dígitos.', 'error');
      return;
    }
    
    setDeliveryCodeError(false);
    setActionLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', activeDelivery.id);
      await supabase.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', activeDelivery.order_id);

      const newBalance = (courier.available_balance || 0) + activeDelivery.courier_earning;
      const newTotal = (courier.total_deliveries || 0) + 1;
      await supabase.from('couriers').update({ available_balance: newBalance, total_deliveries: newTotal }).eq('id', courier.id);
      setCourier({ ...courier, available_balance: newBalance, total_deliveries: newTotal });

      setDeliveryCodeInput('');
      setDeliveryState('none');
      setActiveDelivery(null);
      setActiveTab('earnings');
      showToast('Entrega confirmada com sucesso! 🎉', 'success');
    } catch (e) {
      showToast('Erro ao finalizar entrega', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const isDeliveryActive = deliveryState !== 'none';

  if (loading && !courier && activeTab !== 'earnings') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900">
        <Loader2 className="animate-spin text-brand-primary mb-4" size={48} />
        <p className="text-gray-400 font-medium">Carregando painel do motoboy...</p>
      </div>
    );
  }

  if (!loading && !courier) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900">
        <p className="text-red-400 font-bold mb-4">Perfil de motoboy não encontrado.</p>
        <button onClick={onExit} className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold">Sair do App</button>
      </div>
    );
  }

  if (!courier) return null;

  return (
    <div className="w-full max-w-lg mx-auto h-screen bg-gray-900 flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[900px] sm:my-8 md:max-w-2xl md:h-[95vh] border-4 border-gray-800 font-sans" style={{paddingTop: 'env(safe-area-inset-top, 0px)'}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {!isDeliveryActive && (
        <div className="bg-gray-900 text-white p-5 flex justify-between items-center border-b border-gray-800 shrink-0">
          <div className="flex items-center">
            <div className="relative">
              {courier.users?.avatar_url ? (
                <img src={courier.users.avatar_url} alt="Perfil" className="w-12 h-12 rounded-full object-cover border-2 border-gray-700" />
              ) : (
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center font-bold text-xl border-2 border-gray-700">
                  {courier.users?.name?.charAt(0).toUpperCase() || 'M'}
                </div>
              )}
              {courier.is_online ? (
                gpsError ? (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-yellow-500 rounded-full border-2 border-gray-900 flex items-center justify-center"><AlertTriangle size={10} className="text-gray-900"/></div>
                ) : (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-brand-primary rounded-full border-2 border-gray-900"></div>
                )
              ) : (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-500 rounded-full border-2 border-gray-900"></div>
              )}
            </div>
            <div className="ml-3">
              <h2 className="font-bold text-sm">{courier.users?.name || 'Motoboy'}</h2>
              {courier.is_online && (
                <p className={`text-[10px] font-bold ${gpsError ? 'text-yellow-500' : 'text-brand-primary'}`}>
                  {gpsError ? '⚠️ Sinal GPS fraco' : '● GPS Ativo'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
        
        {/* BANNER DE NOTIFICAÇÕES */}
        {!isDeliveryActive && activeTab === 'home' && notifPermission === 'default' && (
          <div className="m-4 bg-gray-800 border border-gray-700 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-700 text-brand-primary rounded-full flex items-center justify-center mr-3">
                <BellRing size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Ative as Notificações</h3>
                <p className="text-[10px] text-gray-400">Para não perder nenhuma corrida.</p>
              </div>
            </div>
            <button onClick={requestPermission} className="bg-brand-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-green-600 transition-colors">
              Ativar
            </button>
          </div>
        )}

        {deliveryState === 'offered' && activeDelivery && (
          <div className="flex-1 flex flex-col bg-gray-900 p-4 justify-center relative">
            <div className="bg-gray-800 w-full rounded-3xl p-6 shadow-2xl relative z-10 border border-gray-700">
              <div className="text-center mb-6"><span className="bg-brand-secondary text-brand-dark text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider animate-pulse">Nova Entrega Disponível</span></div>
              
              <div className="mb-6 bg-gray-900 p-4 rounded-xl border border-gray-700">
                <div className="flex items-start mb-3">
                  <Store className="text-brand-primary mr-3 mt-1" size={20} />
                  <div>
                    <p className="text-white font-bold">{activeDelivery.order.stores?.name}</p>
                    <p className="text-gray-400 text-xs mt-1">{activeDelivery.order.stores?.addresses?.street}, {activeDelivery.order.stores?.addresses?.number} - {activeDelivery.order.stores?.addresses?.neighborhood}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8">
                <div><p className="text-gray-400 text-sm mb-1">Seu Ganho</p><p className="text-5xl font-black text-brand-primary">R$ {activeDelivery.courier_earning?.toFixed(2) || '0.00'}</p></div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-6 overflow-hidden">
                <div className="bg-brand-secondary h-2 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(acceptTimer / 60) * 100}%` }}></div>
              </div>
              <div className="flex space-x-3">
                <button onClick={handleReject} disabled={actionLoading} className="flex-1 py-4 rounded-xl font-bold text-gray-300 bg-gray-700">Recusar ({acceptTimer}s)</button>
                <button onClick={handleAccept} disabled={actionLoading} className="flex-[2] py-4 rounded-xl font-bold text-white bg-brand-primary flex justify-center items-center">
                  {actionLoading ? <Loader2 className="animate-spin" size={20}/> : 'Aceitar Corrida'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deliveryState === 'going_to_store' && activeDelivery && (
          <div className="flex-1 flex flex-col bg-gray-900 p-6 overflow-y-auto">
            <div className="mt-4 mb-auto">
              <h2 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Coleta na Loja</h2>
              <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 mb-4">
                <h3 className="text-2xl font-black text-white mb-1">{activeDelivery.order.stores?.name}</h3>
                <p className="text-gray-400 text-sm flex items-start mt-2"><MapPin size={16} className="mr-2 shrink-0 mt-0.5"/> {activeDelivery.order.stores?.addresses?.street}, {activeDelivery.order.stores?.addresses?.number} - {activeDelivery.order.stores?.addresses?.neighborhood}</p>
              </div>
              
              {/* MAPA E NAVEGAÇÃO PARA A LOJA */}
              <AddressMap 
                address={activeDelivery.order.stores?.addresses ? `${activeDelivery.order.stores.addresses.street}, ${activeDelivery.order.stores.addresses.number} - ${activeDelivery.order.stores.addresses.neighborhood}, ${activeDelivery.order.stores.addresses.city}` : ''} 
              />
              
              <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 mb-4">
                <p className="text-gray-400 text-xs mb-2">Pedido #{activeDelivery.order_id}</p>
                <div className="space-y-1">
                  {activeDelivery.order.order_items?.map((item:any) => (
                    <p key={item.id} className="text-white text-sm font-medium">{item.quantity}x {item.product_name}</p>
                  ))}
                </div>
              </div>
            </div>
            
            <button onClick={handleArrivedStore} disabled={actionLoading} className="w-full mt-4 bg-brand-primary text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg shadow-brand-primary/20 shrink-0">
              {actionLoading ? <Loader2 className="animate-spin" size={24}/> : 'Cheguei na Loja'}
            </button>
          </div>
        )}

        {deliveryState === 'at_store' && activeDelivery && (
          <div className="flex-1 flex flex-col bg-gray-900 p-6 justify-center">
            <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-2xl p-6 text-center mb-6">
              <p className="text-brand-primary text-sm font-bold mb-1 uppercase tracking-widest">Apresente o número</p>
              <p className="text-6xl font-black text-white">#{activeDelivery?.order_id}</p>
            </div>
            <button onClick={handlePickup} disabled={actionLoading} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center">
              {actionLoading ? <Loader2 className="animate-spin" size={24}/> : <><CheckCircle size={20} className="mr-2" /> Confirmar Retirada</>}
            </button>
          </div>
        )}

        {deliveryState === 'going_to_client' && activeDelivery && (
          <div className="flex-1 flex flex-col bg-gray-900 p-6 overflow-y-auto">
            <div className="mt-4 mb-auto">
              <h2 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Entrega no Cliente</h2>
              <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-bold text-white">{activeDelivery.order.users?.name}</h3>
                  {activeDelivery.order.users?.phone && (
                    <a
                      href={`tel:${activeDelivery.order.users.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                    >
                      📞 Ligar
                    </a>
                  )}
                </div>
                {activeDelivery.order.users?.phone && (
                  <p className="text-gray-400 text-sm mb-2">{activeDelivery.order.users.phone}</p>
                )}
                <p className="text-gray-400 text-sm flex items-start mt-2"><MapPin size={16} className="mr-2 shrink-0 mt-0.5"/> {activeDelivery.order.addresses?.street}, {activeDelivery.order.addresses?.number} {activeDelivery.order.addresses?.complement ? `- ${activeDelivery.order.addresses?.complement}` : ''}</p>
                <p className="text-gray-400 text-sm ml-6">{activeDelivery.order.addresses?.neighborhood}</p>
              </div>

              {/* MAPA E NAVEGAÇÃO PARA O CLIENTE */}
              <AddressMap 
                address={activeDelivery.order.addresses ? `${activeDelivery.order.addresses.street}, ${activeDelivery.order.addresses.number} - ${activeDelivery.order.addresses.neighborhood}, ${activeDelivery.order.addresses.city}` : ''} 
              />

              {/* OBSERVAÇÕES DO CLIENTE */}
              {activeDelivery.order.client_notes && (
                <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-2xl mb-4">
                  <div className="flex items-center text-yellow-500 font-bold mb-2 text-sm"><FileText size={18} className="mr-2"/> OBSERVAÇÕES DO CLIENTE</div>
                  <p className="text-yellow-100 text-sm font-medium">{activeDelivery.order.client_notes}</p>
                </div>
              )}

              {activeDelivery.order.payment_method === 'cash' ? (
                <div className="bg-green-900/40 border border-green-500/50 p-5 rounded-2xl mb-4">
                  <div className="flex items-center text-green-400 font-bold mb-2"><Banknote size={20} className="mr-2"/> COBRAR EM DINHEIRO</div>
                  <p className="text-3xl font-black text-white">R$ {activeDelivery.order.total.toFixed(2)}</p>
                  {activeDelivery.order.change_for && (
                    <p className="text-green-300 text-sm mt-2 font-medium">Levar troco para R$ {activeDelivery.order.change_for.toFixed(2)}</p>
                  )}
                </div>
              ) : (
                <div className="bg-blue-900/40 border border-blue-500/50 p-5 rounded-2xl mb-4">
                  <div className="flex items-center text-blue-400 font-bold mb-1"><CreditCard size={20} className="mr-2"/> PAGAMENTO PIX</div>
                  <p className="text-blue-200 text-sm">O cliente já escolheu pagar via PIX. Combine a chave na entrega. Valor: R$ {activeDelivery.order.total.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Input de código de confirmação */}
            <div className="space-y-3 mt-4 shrink-0">
              {activeDelivery.order.delivery_code ? (
                <div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 text-center">
                    Digite o código do cliente para confirmar a entrega
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={deliveryCodeInput}
                    onChange={e => {
                      setDeliveryCodeError(false);
                      setDeliveryCodeInput(e.target.value.slice(0, 4));
                    }}
                    placeholder="0000"
                    className={`w-full text-center text-4xl font-black tracking-[0.4em] bg-gray-800 border-2 ${
                      deliveryCodeError ? 'border-red-500 text-red-400' : 'border-gray-600 text-white'
                    } rounded-2xl py-5 focus:border-brand-primary focus:outline-none transition-colors`}
                  />
                  {deliveryCodeError && (
                    <p className="text-red-400 text-xs text-center mt-2 font-medium">
                      Código incorreto. Verifique com o cliente.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-2xl text-center">
                  <p className="text-yellow-500 text-sm font-bold">Pedido Legado</p>
                  <p className="text-yellow-100 text-xs mt-1">Este pedido não possui código de confirmação. Confirme a entrega diretamente.</p>
                </div>
              )}
              <button
                onClick={handleDelivered}
                disabled={actionLoading || (activeDelivery.order.delivery_code && deliveryCodeInput.length !== 4)}
                className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={24}/> : <><CheckCircle size={20} className="mr-2"/> Confirmar Entrega</>}
              </button>
            </div>
          </div>
        )}

        {!isDeliveryActive && activeTab === 'home' && (
          <div className="flex-1 flex flex-col p-6 items-center justify-center">
            <button onClick={toggleOnline} disabled={loading} className={`w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ${courier.is_online ? 'bg-brand-primary scale-105' : 'bg-gray-800 border-4 border-gray-700 hover:bg-gray-700'}`}>
              {loading ? <Loader2 className="animate-spin text-white" size={48}/> : (
                <>
                  <Power size={56} className={`mb-3 ${courier.is_online ? 'text-white' : 'text-gray-400'}`} />
                  <span className={`font-black text-2xl tracking-wider ${courier.is_online ? 'text-white' : 'text-gray-400'}`}>{courier.is_online ? 'ONLINE' : 'OFFLINE'}</span>
                </>
              )}
            </button>
            <p className="text-gray-400 mt-10 text-center text-sm font-medium">{courier.is_online ? 'Rastreamento GPS ativado. Buscando entregas...' : 'Toque para ligar o GPS e ficar online.'}</p>
            {gpsError && (
              <div className="mt-6 bg-red-900/40 border border-red-500/50 rounded-2xl p-4 text-center mx-4">
                <p className="text-red-400 font-bold text-sm mb-1">⚠️ Permissão de localização negada</p>
                <p className="text-red-300 text-xs">Vá em <span className="font-bold">Configurações {'>'} Tá Na Mão {'>'} Localização</span> e selecione <span className="font-bold">"Ao usar o app"</span>.</p>
              </div>
            )}
          </div>
        )}

        {!isDeliveryActive && activeTab === 'earnings' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-5">Seus Ganhos</h2>

            {/* Cards de saldo total */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
                <div className="w-10 h-10 bg-brand-primary/20 rounded-full flex items-center justify-center text-brand-primary mb-3">
                  <DollarSign size={20}/>
                </div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Saldo Disponível</p>
                <p className="text-2xl font-black text-white mt-1">R$ {courier.available_balance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 mb-3">
                  <Bike size={20}/>
                </div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total de Entregas</p>
                <p className="text-2xl font-black text-white mt-1">{courier.total_deliveries || 0}</p>
              </div>
            </div>

            {/* Filtro de período */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 mb-6">
              <div className="flex bg-gray-900 p-1 rounded-xl mb-4">
                {([['today', 'Hoje'], ['week', '7 dias'], ['month', '30 dias']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setEarningsPeriod(val)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${earningsPeriod === val ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-brand-primary text-2xl font-black">R$ {periodEarnings.toFixed(2)}</p>
                  <p className="text-gray-400 text-xs mt-1">Ganhos no período</p>
                </div>
                <div className="text-center">
                  <p className="text-white text-2xl font-black">{periodDeliveries}</p>
                  <p className="text-gray-400 text-xs mt-1">Entregas no período</p>
                </div>
              </div>
            </div>

            {/* Histórico */}
            <h3 className="text-lg font-bold text-white mb-4">Histórico de Entregas</h3>
            <div className="space-y-3">
              {loading && deliveriesHistory.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-primary" size={32}/></div>
              ) : deliveriesHistory.length === 0 ? (
                <div className="text-center py-10 bg-gray-800 rounded-2xl border border-gray-700">
                  <Bike size={40} className="text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Nenhuma entrega realizada ainda.<br/>Fique online para receber corridas!</p>
                </div>
              ) : (
                deliveriesHistory.map(delivery => (
                  <div key={delivery.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{delivery.orders?.stores?.name || 'Loja'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(delivery.orders?.created_at).toLocaleDateString('pt-BR')} às {new Date(delivery.orders?.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-brand-primary">R$ {delivery.courier_earning?.toFixed(2)}</p>
                      <span className="text-[10px] font-bold bg-green-900/40 text-green-400 px-2 py-0.5 rounded mt-1 inline-block">
                        <CheckCircle size={10} className="inline mr-1 mb-0.5"/> Entregue
                      </span>
                    </div>
                  </div>
                ))
              )}
              
              {/* Botão carregar mais */}
              {earningsHasMore && deliveriesHistory.length > 0 && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => {
                      const next = earningsPage + 1;
                      setEarningsPage(next);
                      fetchEarningsHistory(next, true);
                    }}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl font-bold hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    Carregar mais
                  </button>
                </div>
              )}
              {!earningsHasMore && deliveriesHistory.length > 0 && (
                <p className="text-center text-gray-500 text-sm mt-4 pb-4">Todas as entregas foram carregadas.</p>
              )}
            </div>
          </div>
        )}

        {!isDeliveryActive && activeTab === 'profile' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Meu Perfil</h2>

            {/* Avatar e nome */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full bg-gray-800 border-4 border-brand-primary flex items-center justify-center text-brand-primary font-black text-4xl mb-4 overflow-hidden">
                {courier?.users?.avatar_url
                  ? <img src={courier.users.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
                  : (courier?.users?.name?.charAt(0).toUpperCase() || 'M')
                }
              </div>
              <h3 className="text-xl font-black text-white">{courier?.users?.name || 'Motoboy'}</h3>
              <p className="text-gray-400 text-sm mt-1">{courier?.users?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                {courier?.is_approved
                  ? <span className="text-xs font-bold bg-green-900/40 text-green-400 px-3 py-1 rounded-full border border-green-800">✓ Aprovado</span>
                  : <span className="text-xs font-bold bg-yellow-900/40 text-yellow-400 px-3 py-1 rounded-full border border-yellow-800">⏳ Em análise</span>
                }
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                <p className="text-2xl font-black text-brand-primary">{courier?.total_deliveries || 0}</p>
                <p className="text-gray-400 text-xs mt-1">Entregas realizadas</p>
              </div>
              <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                <p className="text-2xl font-black text-white">R$ {courier?.available_balance?.toFixed(2) || '0.00'}</p>
                <p className="text-gray-400 text-xs mt-1">Saldo disponível</p>
              </div>
            </div>

            {/* Dados editáveis */}
            {!showProfileEdit ? (
              <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-white">Dados Pessoais</h4>
                  <button
                    onClick={() => {
                      setProfileForm({ name: courier?.users?.name || '', phone: courier?.users?.phone || '' });
                      setShowProfileEdit(true);
                    }}
                    className="text-brand-primary text-sm font-bold hover:underline"
                  >
                    Editar
                  </button>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Nome</p>
                  <p className="text-white font-medium">{courier?.users?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">E-mail</p>
                  <p className="text-white font-medium">{courier?.users?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Telefone</p>
                  <p className="text-white font-medium">{courier?.users?.phone || 'Não informado'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 space-y-4">
                <h4 className="font-bold text-white mb-2">Editar Dados</h4>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nome</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowProfileEdit(false)}
                    className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-bold hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    className="flex-[2] py-3 bg-brand-primary text-white rounded-xl font-bold flex justify-center items-center disabled:opacity-50"
                  >
                    {profileLoading ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Sair */}
            <button
              onClick={onExit}
              className="mt-6 w-full py-3 bg-gray-800 border border-gray-700 text-red-400 rounded-xl font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} /> Sair do App
            </button>
            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="mt-2 w-full py-3 bg-gray-900 border border-gray-700 text-gray-500 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Trash2 size={16} /> Excluir minha conta
            </button>
          </div>
        )}
      </div>
      {/* Modal de confirmação de exclusão de conta */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 bg-red-900/40 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-red-400" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Excluir conta?</h2>
              <p className="text-gray-400 text-sm">Esta ação é permanente. Seus dados serão removidos e você não poderá mais acessar sua conta.</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  setDeleteAccountLoading(true);
                  try { await deleteAccount(); } finally { setDeleteAccountLoading(false); }
                }}
                disabled={deleteAccountLoading}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold flex justify-center items-center disabled:opacity-50"
              >
                {deleteAccountLoading ? <Loader2 size={20} className="animate-spin" /> : 'Sim, excluir minha conta'}
              </button>
              <button onClick={() => setShowDeleteAccountModal(false)} className="w-full bg-gray-800 text-gray-300 py-4 rounded-xl font-bold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {!isDeliveryActive && (
        <div className="bg-gray-900 border-t border-gray-800 flex justify-around py-3 shrink-0 z-20" style={{paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))'}}>
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center w-16 ${activeTab === 'home' ? 'text-brand-primary' : 'text-gray-500'}`}>
            <Power size={24} /><span className="text-[10px] mt-1 font-medium">Início</span>
          </button>
          <button onClick={() => setActiveTab('earnings')} className={`flex flex-col items-center w-16 ${activeTab === 'earnings' ? 'text-brand-primary' : 'text-gray-500'}`}>
            <DollarSign size={24} /><span className="text-[10px] mt-1 font-medium">Ganhos</span>
          </button>
          <button
            onClick={() => {
              setProfileForm({ name: courier?.users?.name || '', phone: courier?.users?.phone || '' });
              setActiveTab('profile');
            }}
            className={`flex flex-col items-center w-16 ${activeTab === 'profile' ? 'text-brand-primary' : 'text-gray-500'}`}
          >
            <User size={24} /><span className="text-[10px] mt-1 font-medium">Perfil</span>
          </button>
        </div>
      )}
    </div>
  );
}
