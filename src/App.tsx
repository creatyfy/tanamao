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
  const { user, profile, loading, signOut, isPasswordRecovery, clearRecovery, refreshProfile } = useAuth();
  const [partnerCheckLoading, setPartnerCheckLoading] = useState(false);
  const [forcePendingApproval, setForcePendingApproval] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const parseDraftInt = (value: any) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number.parseInt(String(value).trim(), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const parseDraftDecimal = (value: any) => {
      if (value === null || value === undefined || value === '') return null;
      const normalized = String(value).trim().replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const ensurePartnerRecord = async () => {
      if (!user || !profile) return;
      if (profile.role !== 'store_owner' && profile.role !== 'courier') return;

      setPartnerCheckLoading(true);

      try {
        // Buscar draft com retry
        let draftRow: { draft?: any } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error: draftError } = await supabase
            .from('registration_drafts')
            .select('draft')
            .eq('user_id', user.id)
            .maybeSingle();
          if (draftError) throw new Error(`Falha ao carregar registration_drafts: ${draftError.message}`);
          if (data?.draft && (data.draft.cnpj || data.draft.cpf)) { draftRow = data; break; }
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        const draft = draftRow?.draft;
        const cleanPhone = typeof draft?.phone === 'string' ? draft.phone.replace(/\D/g, '') : profile.phone;
        const cleanCep = typeof draft?.cep === 'string' ? draft.cep.replace(/\D/g, '') : '00000000';

        if (profile.role === 'store_owner') {
          const { data: store } = await supabase
            .from('stores')
            .select('id, is_approved, status, cnpj')
            .eq('owner_id', user.id)
            .maybeSingle();

          // Loja aprovada — libera acesso
          if (store?.is_approved === true || store?.status === 'active') {
            if (!cancelled) setForcePendingApproval(false);
            return;
          }

          // Loja não existe ou está incompleta — criar/atualizar com draft
          if (!store || !store.cnpj) {
            const safeDraft = draft && typeof draft === 'object' ? draft : {};
            const cleanCnpj = typeof safeDraft.cnpj === 'string' ? safeDraft.cnpj.replace(/\D/g, '') : null;

            const missingFields: string[] = [];
            if (!cleanCnpj || (cleanCnpj.length !== 11 && cleanCnpj.length !== 14)) missingFields.push('CPF/CNPJ');
            if (!safeDraft.street || safeDraft.street === 'Não informado') missingFields.push('Endereço');
            if (!safeDraft.neighborhood || safeDraft.neighborhood === 'Não informado') missingFields.push('Bairro');
            if (!safeDraft.city || safeDraft.city === 'Não informado') missingFields.push('Cidade');
            if (!safeDraft.cep || safeDraft.cep.replace(/\D/g, '').length < 8) missingFields.push('CEP');
            if (cleanCnpj?.length === 11 && !safeDraft.birthDate) missingFields.push('Data de nascimento');
            if (parseDraftInt(safeDraft.prepTime) === null) missingFields.push('Tempo de preparo');
            if (parseDraftDecimal(safeDraft.deliveryFee) === null) missingFields.push('Taxa de entrega');
            if (!safeDraft.pixKey) missingFields.push('Chave PIX');

            if (missingFields.length > 0) {
              console.error('Cadastro de loja incompleto:', missingFields);
              if (!cancelled) setForcePendingApproval(true);
              return;
            }

            const { data: existingAddress } = await supabase.from('addresses').select('id').eq('user_id', user.id).maybeSingle();
            let addressId = existingAddress?.id || null;
            const addressPayload = {
              user_id: user.id, street: safeDraft.street, number: safeDraft.number || 'S/N',
              complement: safeDraft.complement || null, neighborhood: safeDraft.neighborhood,
              city: safeDraft.city, state: safeDraft.state || 'SP', zip_code: cleanCep
            };
            if (addressId) {
              await supabase.from('addresses').update(addressPayload).eq('id', addressId);
            } else {
              const { data: newAddr } = await supabase.from('addresses').insert(addressPayload).select('id').single();
              addressId = newAddr?.id || null;
            }

            const storePayload = {
              owner_id: user.id,
              name: safeDraft.storeName || profile.name || 'Nova Loja',
              slug: `store-${user.id.substring(0, 8)}`,
              cnpj: cleanCnpj, phone: cleanPhone,
              description: safeDraft.description || null,
              global_category_id: safeDraft.category ? parseInt(safeDraft.category) : null,
              avg_prep_time_min: parseDraftInt(safeDraft.prepTime),
              min_order_value: parseDraftDecimal(safeDraft.minOrder) ?? 0,
              delivery_fee: parseDraftDecimal(safeDraft.deliveryFee),
              accepts_pix: safeDraft.acceptsPix ?? true, accepts_card: safeDraft.acceptsCard ?? true,
              accepts_cash: safeDraft.acceptsCash ?? false,
              address_id: addressId, status: 'pending', is_approved: false,
              commission_rate: 4, pix_key: safeDraft.pixKey || null,
              birth_date: safeDraft.birthDate || null
            };

            if (store?.id) {
              await supabase.from('stores').update(storePayload).eq('id', store.id);
            } else {
              await supabase.from('stores').insert(storePayload);
            }
            await supabase.from('registration_drafts').delete().eq('user_id', user.id);
          }

          // Loja existe mas não aprovada — aguarda aprovação
          if (!cancelled) setForcePendingApproval(true);
        }

        if (profile.role === 'courier') {
          const { data: courier } = await supabase
            .from('couriers')
            .select('id, is_approved, status')
            .eq('user_id', user.id)
            .maybeSingle();

          // Motoboy aprovado — libera acesso
          if (courier?.is_approved === true || courier?.status === 'active') {
            if (!cancelled) setForcePendingApproval(false);
            return;
          }

          // Motoboy não existe — criar com draft
          if (!courier) {
            const safeDraft = draft && typeof draft === 'object' ? draft : {};
            const cpfFromMeta = typeof user.user_metadata?.cpf === 'string' ? user.user_metadata.cpf : null;
            const cleanCpf = (cpfFromMeta || safeDraft.cpf || '').toString().replace(/\D/g, '');

            if (!cleanCpf || cleanCpf.length !== 11 || !safeDraft.pixKey || !safeDraft.street) {
              console.error('Cadastro de motoboy incompleto');
              if (!cancelled) setForcePendingApproval(true);
              return;
            }

            await supabase.from('couriers').insert({
              user_id: user.id, cpf: cleanCpf,
              vehicle_type: safeDraft.vehicleType || 'motorcycle',
              vehicle_brand: safeDraft.vehicleBrand || null,
              vehicle_model: safeDraft.vehicleModel || null,
              vehicle_year: safeDraft.vehicleYear ? parseInt(safeDraft.vehicleYear) : new Date().getFullYear(),
              license_plate: safeDraft.licensePlate || null,
              pix_key: safeDraft.pixKey || null,
              operation_city: safeDraft.operationCity || safeDraft.city || 'Não informado',
              status: 'pending', is_approved: false,
              birth_date: safeDraft.birthDate || null
            });
            await supabase.from('registration_drafts').delete().eq('user_id', user.id);
          }

          // Motoboy existe mas não aprovado — aguarda aprovação
          if (!cancelled) setForcePendingApproval(true);
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
  if (forcePendingApproval && profile.role !== 'admin') {
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
