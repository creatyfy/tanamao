import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Courier, Delivery, Order } from '../types';
import { Power, MapPin, DollarSign, Navigation, CheckCircle, User, List, Bell, Star, Store, Loader2 } from 'lucide-react';

export default function CourierApp({ onExit }: { onExit: () => void }) {
  const { user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  
  const [deliveryState, setDeliveryState] = useState('none'); 
  const [acceptTimer, setAcceptTimer] = useState(15);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);

  useEffect(() => {
    if (user) fetchCourier();
  }, [user]);

  const fetchCourier = async () => {
    try {
      const { data } = await supabase.from('couriers').select('*').eq('user_id', user!.id).single();
      if (data) {
        setCourier(data);
        if (data.is_online) subscribeToDeliveries(data.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!courier) return;
    setLoading(true);
    try {
      const newStatus = !courier.is_online;
      await supabase.from('couriers').update({ is_online: newStatus }).eq('id', courier.id);
      setCourier({ ...courier, is_online: newStatus });
      if (newStatus) {
        subscribeToDeliveries(courier.id);
      } else {
        supabase.removeAllChannels();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToDeliveries = (courierId: number) => {
    supabase.channel('courier_offers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries', filter: `courier_id=eq.${courierId}` }, async (payload) => {
        const delivery = payload.new;
        if (delivery.status === 'offered') {
          // Fetch order details
          const { data: order } = await supabase.from('orders').select('*, stores(name, address_id), addresses(*)').eq('id', delivery.order_id).single();
          setActiveDelivery({ ...delivery, order });
          setDeliveryState('offered');
          setAcceptTimer(15);
        }
      }).subscribe();
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (deliveryState === 'offered' && acceptTimer > 0) {
      interval = setInterval(() => setAcceptTimer(prev => prev - 1), 1000);
    } else if (deliveryState === 'offered' && acceptTimer === 0) {
      setDeliveryState('none');
      setActiveDelivery(null);
    }
    return () => clearInterval(interval);
  }, [deliveryState, acceptTimer]);

  // GPS Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (courier?.is_online && deliveryState !== 'none') {
      interval = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            await supabase.from('couriers').update({
              last_lat: pos.coords.latitude,
              last_lng: pos.coords.longitude,
              location_at: new Date().toISOString()
            }).eq('id', courier.id);
          });
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [courier?.is_online, deliveryState]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'going_to_store', accepted_at: new Date().toISOString() }).eq('id', activeDelivery.id);
      await supabase.from('orders').update({ courier_id: courier!.id }).eq('id', activeDelivery.order_id);
      setDeliveryState('going_to_store');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReject = () => {
    setDeliveryState('none');
    setActiveDelivery(null);
  };

  const handleArrivedStore = async () => {
    setLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'at_store', pickup_at: new Date().toISOString() }).eq('id', activeDelivery.id);
      setDeliveryState('at_store');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handlePickup = async () => {
    setLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'delivering' }).eq('id', activeDelivery.id);
      setDeliveryState('going_to_client');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleDelivered = async () => {
    setLoading(true);
    try {
      await supabase.from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', activeDelivery.id);
      await supabase.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', activeDelivery.order_id);
      setDeliveryState('none');
      setActiveDelivery(null);
      setActiveTab('earnings');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const isDeliveryActive = deliveryState !== 'none';

  if (!courier) return <div className="bg-gray-900 h-screen text-white p-8">Carregando...</div>;

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-gray-900 flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-8 border-4 border-gray-800 font-sans">
      {loading && <div className="absolute inset-0 bg-gray-900/80 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={40}/></div>}
      
      {!isDeliveryActive && (
        <div className="bg-gray-900 text-white p-5 flex justify-between items-center border-b border-gray-800 shrink-0">
          <div className="flex items-center">
            <div className="relative">
              <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center font-bold text-xl border-2 border-gray-700">M</div>
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${courier.is_online ? 'bg-brand-primary' : 'bg-gray-500'}`}></div>
            </div>
            <div className="ml-3">
              <h2 className="font-bold text-sm">Motoboy</h2>
            </div>
          </div>
          <button onClick={onExit} className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
            <LogOut size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
        {deliveryState === 'offered' && activeDelivery && (
          <div className="flex-1 flex flex-col bg-gray-900 p-4 justify-center relative">
            <div className="bg-gray-800 w-full rounded-3xl p-6 shadow-2xl relative z-10 border border-gray-700">
              <div className="text-center mb-6"><span className="bg-brand-secondary text-brand-dark text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider animate-pulse">Nova Entrega Disponível</span></div>
              <div className="flex justify-between items-end mb-8">
                <div><p className="text-gray-400 text-sm mb-1">Valor da Entrega</p><p className="text-5xl font-black text-brand-primary">R$ {activeDelivery.courier_earning?.toFixed(2) || '8.50'}</p></div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-6 overflow-hidden">
                <div className="bg-brand-secondary h-2 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(acceptTimer / 15) * 100}%` }}></div>
              </div>
              <div className="flex space-x-3">
                <button onClick={handleReject} className="flex-1 py-4 rounded-xl font-bold text-gray-300 bg-gray-700">Recusar ({acceptTimer}s)</button>
                <button onClick={handleAccept} className="flex-[2] py-4 rounded-xl font-bold text-white bg-brand-primary">Aceitar Corrida</button>
              </div>
            </div>
          </div>
        )}

        {deliveryState === 'going_to_store' && (
          <div className="flex-1 flex flex-col bg-gray-900 p-6 justify-end">
             <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
              <h2 className="font-bold text-xl text-white mb-4">Siga para a Loja</h2>
              <button onClick={handleArrivedStore} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg">Cheguei na Loja</button>
             </div>
          </div>
        )}

        {deliveryState === 'at_store' && (
          <div className="flex-1 flex flex-col bg-gray-900 p-6 justify-center">
            <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-2xl p-6 text-center mb-6">
              <p className="text-brand-primary text-sm font-bold mb-1 uppercase tracking-widest">Pedido</p>
              <p className="text-5xl font-black text-white">#{activeDelivery?.order_id}</p>
            </div>
            <button onClick={handlePickup} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg"><CheckCircle size={20} className="mr-2 inline" /> Confirmar Retirada</button>
          </div>
        )}

        {deliveryState === 'going_to_client' && (
          <div className="flex-1 flex flex-col bg-gray-900 p-6 justify-end">
            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
              <h2 className="font-bold text-xl text-white mb-4">Siga para o Cliente</h2>
              <button onClick={handleDelivered} className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg"><CheckCircle size={20} className="mr-2 inline" /> Finalizar Entrega</button>
             </div>
          </div>
        )}

        {!isDeliveryActive && activeTab === 'home' && (
          <div className="flex-1 flex flex-col p-6 items-center justify-center">
            <button onClick={toggleOnline} className={`w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ${courier.is_online ? 'bg-brand-primary scale-105' : 'bg-gray-800 border-4 border-gray-700'}`}>
              <Power size={56} className={`mb-3 ${courier.is_online ? 'text-white' : 'text-gray-400'}`} />
              <span className={`font-black text-2xl tracking-wider ${courier.is_online ? 'text-white' : 'text-gray-400'}`}>{courier.is_online ? 'ONLINE' : 'OFFLINE'}</span>
            </button>
            <p className="text-gray-400 mt-10 text-center text-sm font-medium">{courier.is_online ? 'Buscando entregas...' : 'Toque para ficar online.'}</p>
          </div>
        )}
      </div>

      {!isDeliveryActive && (
        <div className="bg-gray-900 border-t border-gray-800 flex justify-around py-3 pb-6 shrink-0">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center w-16 ${activeTab === 'home' ? 'text-brand-primary' : 'text-gray-500'}`}><Power size={24} /><span className="text-[10px] mt-1 font-medium">Início</span></button>
          <button onClick={() => setActiveTab('earnings')} className={`flex flex-col items-center w-16 ${activeTab === 'earnings' ? 'text-brand-primary' : 'text-gray-500'}`}><DollarSign size={24} /><span className="text-[10px] mt-1 font-medium">Ganhos</span></button>
        </div>
      )}
    </div>
  );
}
