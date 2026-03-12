import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Store, Bike, Settings, LogOut, CheckCircle, Ban, Loader2 } from 'lucide-react';

export default function AdminApp({ onExit }: { onExit: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('stores').select('*, users:owner_id(name, email)');
      if (data) setStores(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveStore = async (storeId: number, ownerId: string) => {
    setLoading(true);
    try {
      await supabase.from('stores').update({ is_approved: true, status: 'active' }).eq('id', storeId);
      await supabase.from('users').update({ is_active: true }).eq('id', ownerId);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 w-full">
      <div className="w-64 bg-brand-dark text-white flex flex-col">
        <div className="p-6 border-b border-emerald-800">
          <h1 className="text-2xl font-black flex items-center"><span className="text-brand-secondary mr-2">Tá Na Mão</span></h1>
          <p className="text-xs text-emerald-400 mt-1 uppercase tracking-widest">Admin Global</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium ${activeTab === 'dashboard' ? 'bg-brand-primary text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}><LayoutDashboard size={20} /><span>Visão Geral</span></button>
          <button onClick={() => setActiveTab('stores')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium ${activeTab === 'stores' ? 'bg-brand-primary text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}><Store size={20} /><span>Lojas Parceiras</span></button>
        </nav>
        <div className="p-4 border-t border-emerald-800">
          <button onClick={onExit} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-emerald-200 hover:bg-emerald-800 font-medium"><LogOut size={20} /><span>Sair</span></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative">
        {loading && <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-brand-primary" size={40}/></div>}
        
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Dashboard Global</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-lg text-gray-800 flex items-center"><Store size={20} className="mr-2 text-brand-primary"/> Lojas Cadastradas</h3>
                <span className="text-2xl font-bold text-brand-primary">{stores.length}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stores' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestão de Lojas</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                    <th className="p-4 font-medium">Loja</th>
                    <th className="p-4 font-medium">Dono</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map(store => (
                    <tr key={store.id} className="border-b border-gray-100">
                      <td className="p-4 font-semibold text-gray-800">{store.name}</td>
                      <td className="p-4 text-gray-600">{store.users?.name || store.users?.email}</td>
                      <td className="p-4">
                        {store.is_approved ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">Aprovada</span> : <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">Pendente</span>}
                      </td>
                      <td className="p-4 text-right">
                        {!store.is_approved && <button onClick={() => handleApproveStore(store.id, store.owner_id)} className="p-2 text-white bg-brand-primary rounded-lg flex items-center text-xs font-bold px-3 ml-auto"><CheckCircle size={14} className="mr-1"/> Aprovar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
