import React, { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import MobileAuth from './apps/MobileAuth';
import ClientApp from './apps/ClientApp';
import StoreApp from './apps/StoreApp';
import CourierApp from './apps/CourierApp';
import AdminApp from './apps/AdminApp';
import ResetPasswordScreen from './apps/ResetPasswordScreen';
import { supabase } from './lib/supabase';
import { Loader2, Clock, XCircle } from 'lucide-react';

function App() {
  const { user, profile, loading, signOut, isPasswordRecovery, clearRecovery } = useAuth();
  const [partnerCheckLoading, setPartnerCheckLoading] = useState(false);
  const [forcePendingApproval, setForcePendingApproval] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const ensurePartnerRecord = async () => {
      if (!user || !profile) return;
      if (profile.role !== 'store_owner' && profile.role !== 'courier') return;

      setPartnerCheckLoading(true);

      try {
        const draft = user.user_metadata?.registration_draft;
        const cleanPhone = typeof draft?.phone === 'string' ? draft.phone.replace(/\D/g, '') : profile.phone;
        const cleanCep = typeof draft?.cep === 'string' ? draft.cep.replace(/\D/g, '') : '00000000';
        let needsPendingScreen = !profile.is_active;

        if (profile.role === 'store_owner') {
          const { data: store } = await supabase
            .from('stores')
            .select('id, is_approved, status')
            .eq('owner_id', user.id)
            .maybeSingle();

          let storeData = store;
          if (!storeData && draft && typeof draft === 'object') {
            const cleanCnpj = typeof draft.cnpj === 'string' ? draft.cnpj.replace(/\D/g, '') : null;
            const { data: existingAddress } = await supabase
              .from('addresses')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            let addressId = existingAddress?.id || null;
            const addressPayload = {
              user_id: user.id,
              street: draft.street || 'Não informado',
              number: draft.number || 'S/N',
              complement: draft.complement || null,
              neighborhood: draft.neighborhood || 'Não informado',
              city: draft.city || 'Não informado',
              state: draft.state || 'SP',
              zip_code: cleanCep
            };

            if (addressId) {
              await supabase.from('addresses').update(addressPayload).eq('id', addressId);
            } else {
              const { data: newAddress } = await supabase.from('addresses').insert(addressPayload).select('id').single();
              addressId = newAddress?.id || null;
            }

            const { data: insertedStore } = await supabase
              .from('stores')
              .insert({
                owner_id: user.id,
                name: draft.storeName || user.user_metadata?.name || profile.name || 'Nova Loja',
                slug: `store-${user.id.substring(0, 8)}`,
                cnpj: cleanCnpj,
                phone: cleanPhone,
                description: draft.description || null,
                global_category_id: draft.category ? parseInt(draft.category) : null,
                avg_prep_time_min: draft.prepTime ? parseInt(draft.prepTime) : 30,
                min_order_value: draft.minOrder ? parseFloat(draft.minOrder) : 0,
                delivery_fee: draft.deliveryFee ? parseFloat(draft.deliveryFee) : 0,
                accepts_pix: draft.acceptsPix ?? true,
                accepts_card: draft.acceptsCard ?? true,
                accepts_cash: draft.acceptsCash ?? false,
                address_id: addressId,
                status: 'pending',
                is_approved: false,
                commission_rate: 4,
                pix_key: draft.pixKey || null
              })
              .select('id, is_approved, status')
              .maybeSingle();

            storeData = insertedStore || null;
          }

          const isStoreApproved = storeData?.is_approved === true || storeData?.status === 'active';
          if (!storeData || !isStoreApproved) {
            needsPendingScreen = true;
          }
        }

        if (profile.role === 'courier') {
          const { data: courier } = await supabase
            .from('couriers')
            .select('id, is_approved, status')
            .eq('user_id', user.id)
            .maybeSingle();

          let courierData = courier;
          if (!courierData && draft && typeof draft === 'object') {
            const cpfFromMeta = typeof user.user_metadata?.cpf === 'string' ? user.user_metadata.cpf : null;
            const cleanCpf = (cpfFromMeta || draft.cpf || '').toString().replace(/\D/g, '') || '00000000000';

            const { data: insertedCourier } = await supabase
              .from('couriers')
              .insert({
                user_id: user.id,
                cpf: cleanCpf,
                vehicle_type: draft.vehicleType || 'motorcycle',
                vehicle_brand: draft.vehicleBrand || null,
                vehicle_model: draft.vehicleModel || null,
                vehicle_year: draft.vehicleYear ? parseInt(draft.vehicleYear) : new Date().getFullYear(),
                license_plate: draft.licensePlate || null,
                pix_key: draft.pixKey || null,
                operation_city: draft.operationCity || draft.city || 'Não informado',
                status: 'pending',
                is_approved: false
              })
              .select('id, is_approved, status')
              .maybeSingle();

            courierData = insertedCourier || null;
          }

          const isCourierApproved = courierData?.is_approved === true || courierData?.status === 'active';
          if (!courierData || !isCourierApproved) {
            needsPendingScreen = true;
          }
        }

        if (needsPendingScreen) {
          if (profile.is_active) {
            await supabase.from('users').update({ is_active: false }).eq('id', user.id);
          }
          if (!cancelled) setForcePendingApproval(true);
        } else if (!cancelled) {
          setForcePendingApproval(false);
        }
      } catch (error) {
        console.error('Erro ao validar cadastro de parceiro:', error);
      } finally {
        if (!cancelled) setPartnerCheckLoading(false);
      }
    };

    ensurePartnerRecord();
    return () => { cancelled = true; };
  }, [user, profile]);

  if (loading || partnerCheckLoading) {
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
  if ((forcePendingApproval || !profile.is_active) && profile.role !== 'admin') {
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
