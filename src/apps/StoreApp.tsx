import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Store, Order, Product } from '../types';
import { 
  LayoutDashboard, ShoppingBag, Package, DollarSign, LogOut, 
  Check, X, Clock, Plus, Bell, Star, BarChart3, Tag, 
  FolderTree, Bike, Settings, ChevronRight, Edit2, Trash2, 
  Image as ImageIcon, Search, MapPin, MessageSquare, Loader2
} from 'lucide-react';

export default function StoreApp({ onExit }: { onExit: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (user) fetchStoreData();
  }, [user]);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      // Get Store
      const { data: storeData } = await supabase.from('stores').select('*').eq('owner_id', user!.id).single();
      if (storeData) {
        setStore(storeData);
        fetchOrders(storeData.id);
        fetchProducts(storeData.id);
        
        // Realtime Orders
        const channel = supabase.channel(`store_orders_${storeData.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeData.id}` }, () => {
            fetchOrders(storeData.id);
          }).subscribe();
        return () => { supabase.removeChannel(channel); };
      }
    } catch (error) {
      console.error('Erro ao carregar loja:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (storeId: number) => {
    const { data } = await supabase.from('orders')
      .select(`*, users:client_id(name), order_items(*)`)
      .eq('store_id', storeId)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const fetchProducts = async (storeId: number) => {
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId);
    if (data) setProducts(data);
  };

  const toggleStoreStatus = async (isOpen: boolean) => {
    if (!store) return;
    setLoading(true);
    try {
      await supabase.from('stores').update({ is_open: isOpen }).eq('id', store.id);
      setStore({ ...store, is_open: isOpen });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    setLoading(true);
    try {
      const updateData: any = { status };
      if (status === 'cancelled') updateData.cancelled_by = 'store';
      await supabase.from('orders').update(updateData).eq('id', orderId);
      fetchOrders(store!.id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'orders', icon: <ShoppingBag size={20} />, label: 'Pedidos' },
    { id: 'products', icon: <Package size={20} />, label: 'Cardápio' },
  ];

  if (!store) return <div className="p-8">Carregando loja...</div>;

  return (
    <div className="flex h-screen bg-gray-50 w-full font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-black text-brand-dark flex items-center"><span className="text-brand-primary mr-2">Tá Na Mão</span></h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Portal do Parceiro</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {menuItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === item.id ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-gray-600 hover:bg-brand-light hover:text-brand-primary'}`}>
              {item.icon}<span>{item.label}</span>
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
        
        <header className="bg-white border-b border-gray-200 h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center font-bold text-gray-500">{store.name.charAt(0)}</div>
            <div>
              <h2 className="font-bold text-brand-dark leading-tight">{store.name}</h2>
              <p className="text-xs text-gray-500">{store.is_approved ? 'Aprovada' : 'Pendente'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-gray-50 p-1.5 rounded-full border border-gray-200">
              <button onClick={() => toggleStoreStatus(false)} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${!store.is_open ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}>Fechada</button>
              <button onClick={() => toggleStoreStatus(true)} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${store.is_open ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-400'}`}>Aberta</button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8">
              <h2 className="text-3xl font-black text-brand-dark">Olá, Parceiro! 👋</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="p-3 bg-brand-light rounded-xl text-brand-primary w-fit mb-4"><ShoppingBag size={24} /></div>
                  <h3 className="text-3xl font-black text-brand-dark">{orders.length}</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">Pedidos Ativos</p>
                </div>
              </div>
            </div>
          )}

          {/* KANBAN PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              <h2 className="text-2xl font-bold text-brand-dark mb-6">Gestor de Pedidos</h2>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                
                {/* Novos */}
                <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-full">
                  <h3 className="font-bold text-gray-700 mb-4">Novos</h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {orders.filter(o => o.status === 'pending').map(order => (
                      <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-l-brand-secondary">
                        <div className="flex justify-between items-start mb-3">
                          <div><span className="text-xs font-bold text-gray-400">#{order.id}</span><h4 className="font-bold text-brand-dark mt-1">{order.users?.name || 'Cliente'}</h4></div>
                        </div>
                        <div className="text-sm text-gray-600 mb-4 space-y-1">
                          {order.order_items?.map((item:any) => <p key={item.id}>{item.quantity}x {item.product_name}</p>)}
                        </div>
                        <div className="font-bold text-brand-dark mb-4">R$ {order.total.toFixed(2)}</div>
                        <div className="flex space-x-2">
                          <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="flex-1 bg-brand-primary text-white py-2.5 rounded-xl text-sm font-bold">Aceitar</button>
                          <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="px-4 bg-gray-100 text-gray-500 py-2.5 rounded-xl text-sm font-bold">Recusar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Em Preparo */}
                <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-full">
                  <h3 className="font-bold text-gray-700 mb-4">Em Preparo</h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {orders.filter(o => o.status === 'accepted' || o.status === 'preparing').map(order => (
                      <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-l-blue-500">
                        <div className="flex justify-between items-start mb-3">
                          <div><span className="text-xs font-bold text-gray-400">#{order.id}</span><h4 className="font-bold text-brand-dark mt-1">{order.users?.name || 'Cliente'}</h4></div>
                        </div>
                        <button onClick={() => updateOrderStatus(order.id, 'ready')} className="w-full bg-blue-50 text-blue-600 py-2.5 rounded-xl text-sm font-bold">Marcar como Pronto</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prontos */}
                <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-full">
                  <h3 className="font-bold text-gray-700 mb-4">Prontos / Rota</h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {orders.filter(o => o.status === 'ready' || o.status === 'delivering').map(order => (
                      <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-l-brand-primary opacity-70">
                        <span className="text-xs font-bold text-gray-400">#{order.id}</span>
                        <h4 className="font-bold text-brand-dark mt-1">{order.users?.name || 'Cliente'}</h4>
                        <p className="text-xs text-gray-500 mt-2">Aguardando/Com Motoboy</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* PRODUTOS */}
          {activeTab === 'products' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-brand-dark">Gestão de Cardápio</h2>
                <button className="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-md"><Plus size={20} className="mr-2" /> Novo Produto</button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">Nome</th>
                      <th className="p-4 font-medium">Preço</th>
                      <th className="p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-brand-dark">{p.name}</td>
                        <td className="p-4 font-bold text-brand-dark">R$ {p.price.toFixed(2)}</td>
                        <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${p.is_available ? 'bg-brand-light text-brand-primary' : 'bg-gray-200 text-gray-600'}`}>{p.is_available ? 'Ativo' : 'Pausado'}</span></td>
                      </tr>
                    ))}
                    {products.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-500">Nenhum produto cadastrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
