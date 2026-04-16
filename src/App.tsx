import React, { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import MobileAuth from './apps/MobileAuth';
import ClientApp from './apps/ClientApp';
import StoreApp from './apps/StoreApp';
import CourierApp from './apps/CourierApp';
import AdminApp from './apps/AdminApp';
import ResetPasswordScreen from './apps/ResetPasswordScreen';
import { Loader2, Clock, XCircle } from 'lucide-react';

function App() {
  const { user, profile, loading, signOut, isPasswordRecovery, clearRecovery } = useAuth();

  if (loading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-brand-primary text-white" style={{paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)'}}>
        <Loader2 className="animate-spin mb-4" size={48} />
        <h1 className="text-2xl font-black">Tá Na Mão</h1>
        <p className="text-sm opacity-80 mt-2">Carregando...</p>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPasswordScreen onDone={() => { clearRecovery(); signOut(); }} />;
  }

  if (!user || !profile) {
    return <MobileAuth />;
  }

  // Verifica se a conta foi excluída pelo usuário (Soft Delete)
  // Clientes inativos SEMPRE são contas excluídas, pois cliente não tem fase de aprovação.
  if (profile.name === 'Conta Excluída' || (!profile.is_active && profile.role === 'client')) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center" style={{paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))'}}>
        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <XCircle size={48} />
        </div>
        <h2 className="text-2xl font-black text-brand-dark mb-2">Conta Excluída</h2>
        <p className="text-gray-600 mb-8 font-medium max-w-sm">Esta conta foi desativada e excluída permanentemente pelo usuário.</p>
        <button onClick={signOut} className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold w-full max-w-xs shadow-lg hover:bg-green-600 transition-colors">Voltar ao Login</button>
      </div>
    );
  }

  // Bloqueia o acesso para usuários não aprovados (Lojas e Motoboys pendentes)
  if (!profile.is_active && profile.role !== 'admin') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center" style={{paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))'}}>
        <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Clock size={48} />
        </div>
        <h2 className="text-2xl font-black text-brand-dark mb-2">Cadastro em Análise</h2>
        <p className="text-gray-600 mb-8 font-medium max-w-sm">Seu perfil está sendo analisado pela nossa equipe. Você terá acesso ao app assim que for aprovado!</p>
        <button onClick={signOut} className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold w-full max-w-xs shadow-lg hover:bg-green-600 transition-colors">Voltar ao Login</button>
      </div>
    );
  }

  if (profile.role === 'client') return <ClientApp onExit={signOut} />;
  if (profile.role === 'store_owner') return <StoreApp onExit={signOut} />;
  if (profile.role === 'courier') return <CourierApp onExit={signOut} />;
  if (profile.role === 'admin') return <AdminApp onExit={signOut} />;

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-white">
      <p className="text-red-500 font-bold mb-4">Perfil inválido ou não aprovado.</p>
      <button onClick={signOut} className="px-6 py-2 bg-gray-200 rounded-xl font-bold">Sair</button>
    </div>
  );
}

export default App;
