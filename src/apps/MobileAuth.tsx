import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Toast } from '../components/Toast';
import { 
  Mail, Lock, User, ArrowRight, Store, Bike, 
  FileText, CheckCircle, Loader2, Phone, MapPin, DollarSign,
  Clock, Map, Calendar, Camera, Image as ImageIcon, UploadCloud
} from 'lucide-react';

const InputField = ({ icon: Icon, placeholder, type = "text", required = false, name, value, onChange, maxLength }: any) => (
  <div className="relative mb-3">
    {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />}
    <input 
      type={type} 
      name={name}
      maxLength={maxLength}
      placeholder={placeholder} 
      required={required}
      value={value}
      onChange={onChange}
      className={`w-full bg-white border border-gray-200 rounded-xl py-3 ${Icon ? 'pl-11' : 'pl-4'} pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm font-medium text-brand-dark shadow-sm`}
    />
  </div>
);

const FormSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
    <h3 className="text-sm font-bold text-brand-dark mb-3 flex items-center">{title}</h3>
    {children}
  </div>
);

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export default function MobileAuth() {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [registerRole, setRegisterRole] = useState<'client' | 'store' | 'courier'>('client');
  const [loading, setLoading] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => setToast({ message, type });
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  
  const [globalCategories, setGlobalCategories] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    email: '', password: '', phone: '',
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
    name: '', cpf: '',
    storeName: '', ownerName: '', cnpj: '', description: '', category: '', prepTime: '', minOrder: '', deliveryFee: '',
    acceptsPix: true, acceptsCard: true, acceptsCash: false, pixKey: '',
    fullName: '', rg: '', birthDate: '', vehicleType: 'motorcycle', vehicleBrand: '', vehicleModel: '', vehicleYear: '', licensePlate: '', operationCity: ''
  });

  const resendConfirmationLink = async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return false;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/confirmado`
      }
    });

    if (error) {
      console.warn('Falha ao reenviar link de confirmação:', error.message);
      return false;
    }

    return true;
  };

  const restorePendingRegistrationFromMetadata = async (user: any, fallbackEmail?: string) => {
    const metaRole = user?.user_metadata?.role;
    const isPendingRole = metaRole === 'store_owner' || metaRole === 'courier';
    if (!user?.id || !isPendingRole) return false;

    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile) return false;

    const draft = user.user_metadata?.registration_draft;
    if (!draft || typeof draft !== 'object') return false;

    const inferredRole: 'store' | 'courier' = metaRole === 'store_owner' ? 'store' : 'courier';
    setRegisterRole(inferredRole);
    setFormData(prev => ({
      ...prev,
      email: user.email || fallbackEmail || prev.email,
      phone: draft.phone || prev.phone,
      cep: draft.cep || prev.cep,
      street: draft.street || prev.street,
      number: draft.number || prev.number,
      complement: draft.complement || prev.complement,
      neighborhood: draft.neighborhood || prev.neighborhood,
      city: draft.city || prev.city,
      state: draft.state || prev.state,
      storeName: draft.storeName || prev.storeName,
      ownerName: draft.ownerName || user.user_metadata?.name || prev.ownerName,
      cnpj: draft.cnpj || prev.cnpj,
      description: draft.description || prev.description,
      category: draft.category || prev.category,
      prepTime: draft.prepTime || prev.prepTime,
      minOrder: draft.minOrder || prev.minOrder,
      deliveryFee: draft.deliveryFee || prev.deliveryFee,
      acceptsPix: draft.acceptsPix ?? prev.acceptsPix,
      acceptsCard: draft.acceptsCard ?? prev.acceptsCard,
      acceptsCash: draft.acceptsCash ?? prev.acceptsCash,
      pixKey: draft.pixKey || prev.pixKey,
      cpf: draft.cpf || user.user_metadata?.cpf || prev.cpf,
      fullName: draft.fullName || user.user_metadata?.name || prev.fullName,
      vehicleType: draft.vehicleType || prev.vehicleType,
      vehicleBrand: draft.vehicleBrand || prev.vehicleBrand,
      vehicleModel: draft.vehicleModel || prev.vehicleModel,
      vehicleYear: draft.vehicleYear || prev.vehicleYear,
      licensePlate: draft.licensePlate || prev.licensePlate,
      operationCity: draft.operationCity || draft.city || prev.operationCity,
    }));
    setAuthMode('register');
    showToast('E-mail confirmado! Clique em Cadastrar para concluir.', 'success');
    return true;
  };

  const checkPendingApproval = async (userId?: string, fallbackRole?: string) => {
    if (!userId) return false;

    const { data: profile, error } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', userId)
      .maybeSingle();

    const roleToCheck = profile?.role || fallbackRole;
    const isPartnerRole = roleToCheck === 'store_owner' || roleToCheck === 'courier';
    const isPendingApproval =
      !error &&
      !!profile &&
      profile.is_active === false &&
      isPartnerRole;

    if (isPendingApproval) {
      setShowPendingApproval(true);
      setErrorMsg('');
      return true;
    }

    return false;
  };

  useEffect(() => {
    // Verifica se o usuário acabou de confirmar o e-mail e precisa concluir o cadastro
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkPendingApproval(session.user.id).then((isPending) => {
          if (isPending) return;
          restorePendingRegistrationFromMetadata(session.user).then((restoredByMetadata) => {
          if (restoredByMetadata) return;

          const pending = localStorage.getItem('pendingRegistration');
          if (pending) {
            try {
              const parsed = JSON.parse(pending);
              setRegisterRole(parsed.role);
              setFormData(parsed.formData);
              setAuthMode('register');
              showToast('E-mail confirmado! Clique em Cadastrar para concluir.', 'success');
              localStorage.removeItem('pendingRegistration');
            } catch (e) {}
          }
        });
        });
      }
    });

    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('store_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        if (data) setGlobalCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = async (e: any) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({ ...prev, [name]: finalValue }));

    if (name === 'cep') {
      const cleanCep = finalValue.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await res.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              street: data.logradouro || prev.street,
              neighborhood: data.bairro || prev.neighborhood,
              city: data.localidade || prev.city,
              state: data.uf || prev.state
            }));
            setErrorMsg('');
          } else {
            setErrorMsg('CEP não encontrado.');
          }
        } catch (error) {
          console.error("Error fetching zip code:", error);
        }
      }
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        setErrorMsg('A imagem do banner deve ter no máximo 5MB.');
        return;
      }
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const isRateLimitError = (message: string, status?: number) => {
    const normalizedMessage = message.toLowerCase();
    return status === 429
      || normalizedMessage.includes('rate limit')
      || normalizedMessage.includes('too many requests')
      || normalizedMessage.includes('for security purposes')
      || normalizedMessage.includes('over_email_send_rate_limit')
      || normalizedMessage.includes('over request rate limit');
  };

  const handleAuthError = (err: any) => {
    // Apenas loga erros reais do sistema para não poluir o console de monitoramento
    if (!err.message || err.status >= 500) {
      console.error("Auth Error:", err);
    }
    
    let msg = err.message || 'Ocorreu um erro inesperado.';
    
    if (msg.includes('Invalid login credentials')) {
      msg = 'E-mail ou senha incorretos.';
    } else if (msg.includes('Email not confirmed')) {
      msg = 'Por favor, confirme seu e-mail antes de fazer login.';
    } else if (msg.includes('Failed to fetch')) {
      msg = 'Erro de conexão. Verifique sua internet.';
    } else if (isRateLimitError(msg, err.status)) {
      msg = 'Muitas tentativas para este e-mail/rede. Aguarde 1-2 minutos e tente novamente.';
    } else if (msg.includes('duplicate key')) {
      msg = 'Alguns dados fornecidos (como RG, CNPJ ou Placa) já estão em uso por outra conta.';
    } else if (msg.includes('too long')) {
      msg = 'Algum campo excedeu o limite de caracteres. Verifique os dados fornecidos.';
    } else if (msg.includes('new row violates row-level security')) {
      msg = 'Erro de permissão. Certifique-se de confirmar seu e-mail primeiro.';
    }
    setErrorMsg(msg);
  };

  const handleLogin = async () => {
    const emailClean = formData.email.trim();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
      email: emailClean, 
      password: formData.password 
    });

    if (signInError) {
      if (signInError.message?.includes('Email not confirmed')) {
        const resent = await resendConfirmationLink(emailClean);
        if (resent) {
          throw new Error('Seu link expirou ou o e-mail ainda não foi confirmado. Reenviamos um novo link de confirmação. Após confirmar, faça login novamente.');
        }
      }
      throw signInError;
    }

    const metaRole = data.user.user_metadata?.role;
    const hasPendingApproval = await checkPendingApproval(data.user.id, metaRole);
    if (hasPendingApproval) return;

    const { data: profile } = await supabase
      .from('users')
      .select('id, role, is_active')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!profile) {
      const restoredByMetadata = await restorePendingRegistrationFromMetadata(data.user, emailClean);
      if (restoredByMetadata) {
        setErrorMsg('Seu cadastro está incompleto. Por favor, revise os dados e clique em Cadastrar para finalizar.');
        return;
      }

      // O usuário confirmou o e-mail mas não concluiu o cadastro na tabela users.
      // Mantemos a sessão ativa e direcionamos para a tela de registro suavemente.
      const inferredRole: 'client' | 'store' | 'courier' =
        metaRole === 'store_owner' ? 'store' : metaRole === 'courier' ? 'courier' : 'client';
      setRegisterRole(inferredRole);
      setFormData(prev => ({
        ...prev,
        email: data.user.email || emailClean,
        name: inferredRole === 'client' ? (data.user.user_metadata?.name || prev.name) : prev.name,
        ownerName: inferredRole === 'store' ? (data.user.user_metadata?.name || prev.ownerName) : prev.ownerName,
        fullName: inferredRole === 'courier' ? (data.user.user_metadata?.name || prev.fullName) : prev.fullName,
      }));
      setAuthMode('register');
      setErrorMsg('Seu cadastro está incompleto. Por favor, preencha os dados abaixo para finalizar.');
      return;
    }

    // Fluxo de recuperação: pode existir perfil em `users`, mas sem o registro específico
    // em `stores`/`couriers` quando o usuário confirmou e-mail mas não concluiu o formulário.
    if (profile.role === 'store_owner') {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', data.user.id)
        .maybeSingle();

      if (!store) {
        const draft = data.user.user_metadata?.registration_draft;
        if (draft && typeof draft === 'object') {
          const cleanCep = typeof draft.cep === 'string' ? draft.cep.replace(/\D/g, '') : '00000000';
          const cleanPhone = typeof draft.phone === 'string' ? draft.phone.replace(/\D/g, '') : null;
          const cleanCnpj = typeof draft.cnpj === 'string' ? draft.cnpj.replace(/\D/g, '') : null;
          const ownerName = data.user.user_metadata?.name || 'Nova Loja';

          const { data: existingAddress } = await supabase
            .from('addresses')
            .select('id')
            .eq('user_id', data.user.id)
            .maybeSingle();

          let addressId = existingAddress?.id || null;
          const addressPayload = {
            user_id: data.user.id,
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
            const { data: newAddress, error: addressError } = await supabase
              .from('addresses')
              .insert(addressPayload)
              .select('id')
              .single();
            if (!addressError) addressId = newAddress.id;
          }

          const { error: storeInsertError } = await supabase.from('stores').insert({
            owner_id: data.user.id,
            name: draft.storeName || ownerName,
            slug: `store-${data.user.id.substring(0, 8)}`,
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
          });

          if (!storeInsertError) {
            await supabase.from('users').update({ is_active: false }).eq('id', data.user.id);
            await supabase.auth.signOut();
            throw new Error('Cadastro da loja finalizado e enviado para análise do admin.');
          }
        }

        setRegisterRole('store');
        setFormData(prev => ({
          ...prev,
          email: data.user.email || emailClean,
          ownerName: data.user.user_metadata?.name || prev.ownerName,
        }));
        setAuthMode('register');
        setErrorMsg('Falta concluir o cadastro da loja. Preencha os dados abaixo e clique em Cadastrar.');
        return;
      }
    }

    if (profile.role === 'courier') {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!courier) {
        const draft = data.user.user_metadata?.registration_draft;
        if (draft && typeof draft === 'object') {
          const cleanCpf = typeof data.user.user_metadata?.cpf === 'string'
            ? data.user.user_metadata.cpf.replace(/\D/g, '')
            : (typeof draft.cpf === 'string' ? draft.cpf.replace(/\D/g, '') : '00000000000');

          const { error: courierInsertError } = await supabase.from('couriers').insert({
            user_id: data.user.id,
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
          });

          if (!courierInsertError) {
            await supabase.from('users').update({ is_active: false }).eq('id', data.user.id);
            await supabase.auth.signOut();
            throw new Error('Cadastro de motoboy finalizado e enviado para análise do admin.');
          }
        }

        setRegisterRole('courier');
        setFormData(prev => ({
          ...prev,
          email: data.user.email || emailClean,
          fullName: data.user.user_metadata?.name || prev.fullName,
        }));
        setAuthMode('register');
        setErrorMsg('Falta concluir o cadastro de motoboy. Preencha os dados abaixo e clique em Cadastrar.');
        return;
      }
    }

    if (!profile.is_active && (profile.role === 'store_owner' || profile.role === 'courier')) {
      setShowPendingApproval(true);
      return;
    }

    window.location.reload();
  };

  const handleForgotPassword = async () => {
    const emailClean = formData.email.trim();
    if (!emailClean) throw new Error('Por favor, informe seu e-mail.');

    const { error } = await supabase.auth.resetPasswordForEmail(emailClean, {
      redirectTo: 'https://tanamao.website/redefinir-senha',
    });
    
    if (error) throw error;
    
    showToast('Link de recuperação enviado para seu e-mail!', 'success');
    setAuthMode('login');
  };

  const handleRegister = async () => {
    const emailClean = formData.email.trim();
    const roleMap: Record<string, string> = { client: 'client', store: 'store_owner', courier: 'courier' };
    const userName = registerRole === 'store' ? formData.ownerName : (registerRole === 'courier' ? formData.fullName : formData.name);

    // Verifica se já existe uma sessão ativa (caso o usuário tenha voltado do link de confirmação de e-mail)
    const { data: { session } } = await supabase.auth.getSession();
    let userId = session?.user?.id;

    if (!userId) {
      const registrationDraft = {
        phone: formData.phone,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        storeName: formData.storeName,
        ownerName: formData.ownerName,
        cnpj: formData.cnpj,
        description: formData.description,
        category: formData.category,
        prepTime: formData.prepTime,
        minOrder: formData.minOrder,
        deliveryFee: formData.deliveryFee,
        acceptsPix: formData.acceptsPix,
        acceptsCard: formData.acceptsCard,
        acceptsCash: formData.acceptsCash,
        pixKey: formData.pixKey,
        cpf: formData.cpf,
        fullName: formData.fullName,
        vehicleType: formData.vehicleType,
        vehicleBrand: formData.vehicleBrand,
        vehicleModel: formData.vehicleModel,
        vehicleYear: formData.vehicleYear,
        licensePlate: formData.licensePlate,
        operationCity: formData.operationCity,
      };

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailClean,
        password: formData.password,
        options: { 
          data: {
            name: userName,
            role: roleMap[registerRole],
            cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null,
            registration_draft: (registerRole === 'store' || registerRole === 'courier') ? registrationDraft : null
          },
          emailRedirectTo: `${window.location.origin}/confirmado`
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: emailClean,
            password: formData.password
          });
          if (signInError) {
            if (signInError.message?.includes('Email not confirmed')) {
              const resent = await resendConfirmationLink(emailClean);
              if (resent) {
                throw new Error('Seu cadastro já existe, mas o link de confirmação expirou ou não foi confirmado. Reenviamos um novo link para seu e-mail.');
              }
            }
            throw new Error('Este e-mail já está cadastrado. Se for você, a senha está incorreta.');
          }
          userId = signInData.user.id;
        } else {
          throw signUpError;
        }
      } else {
        // Se a confirmação de e-mail estiver ativada, a sessão será nula
        if (!signUpData.session) {
          const safeFormData = { ...formData, password: 'dummy_password_not_used' };
          localStorage.setItem('pendingRegistration', JSON.stringify({ role: registerRole, formData: safeFormData }));
          showToast('Verifique seu e-mail para confirmar a conta. Depois, retorne ao app.', 'success');
          setAuthMode('login');
          setFormData(prev => ({ ...prev, password: '' }));
          return; // Para a execução aqui até o e-mail ser confirmado
        }
        userId = signUpData.user?.id;
      }
    }

    if (!userId) throw new Error('Falha ao obter ID do usuário.');

    let finalAvatarUrl = null;
    if (photoFile && userId) {
      try {
        const fileExt = photoFile.name ? photoFile.name.split('.').pop() : 'jpg';
        const fileName = `avatar_${userId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, photoFile, { cacheControl: '3600', upsert: false });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          finalAvatarUrl = publicUrlData.publicUrl;
        }
      } catch (err) { console.warn('Erro ao processar foto:', err); }
    }

    let finalBannerUrl = null;
    if (bannerFile && userId && registerRole === 'store') {
      try {
        const fileExt = bannerFile.name ? bannerFile.name.split('.').pop() : 'jpg';
        const fileName = `store_banner_${userId}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('stores').upload(fileName, bannerFile, { cacheControl: '3600', upsert: false });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('stores').getPublicUrl(fileName);
          finalBannerUrl = publicUrlData.publicUrl;
        }
      } catch (err) { console.warn('Erro ao processar banner:', err); }
    }

    const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '') : null;
    const cleanCep = formData.cep ? formData.cep.replace(/\D/g, '') : '00000000';
    const cleanCnpj = formData.cnpj ? formData.cnpj.replace(/\D/g, '') : null;
    const cleanCpf = formData.cpf ? formData.cpf.replace(/\D/g, '') : '00000000000';
    const isActive = registerRole === 'client';

    const userData: any = {
      id: userId,
      name: userName || emailClean.split('@')[0],
      email: emailClean,
      phone: cleanPhone,
      role: roleMap[registerRole],
      is_active: isActive, 
      password_hash: 'supabase_auth',
      cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null,
    };
    
    if (finalAvatarUrl) userData.avatar_url = finalAvatarUrl;

    const { error: userErr } = await supabase.from('users').upsert(userData, { onConflict: 'id' });
    if (userErr) throw new Error(`Erro ao salvar perfil: ${userErr.message}`);

    let addressId = null;
    if (registerRole === 'store' || registerRole === 'courier') {
      const addressData = {
        user_id: userId,
        street: formData.street || 'Não informado',
        number: formData.number || 'S/N',
        complement: formData.complement || null,
        neighborhood: formData.neighborhood || 'Não informado',
        city: formData.city || 'Não informado',
        state: formData.state || 'SP',
        zip_code: cleanCep
      };

      const { data: existingAddr } = await supabase.from('addresses').select('id').eq('user_id', userId).maybeSingle();
      if (existingAddr) {
        addressId = existingAddr.id;
        await supabase.from('addresses').update(addressData).eq('id', addressId);
      } else {
        const { data: newAddr, error: addrErr } = await supabase.from('addresses').insert(addressData).select().single();
        if (addrErr) throw new Error(`Erro ao salvar endereço: ${addrErr.message}`);
        addressId = newAddr.id;
      }
    }

    if (registerRole === 'store') {
      const storeData: any = {
        owner_id: userId,
        name: formData.storeName || 'Nova Loja',
        slug: `store-${userId.substring(0,8)}`,
        cnpj: cleanCnpj,
        phone: cleanPhone,
        description: formData.description || null,
        global_category_id: formData.category ? parseInt(formData.category) : null,
        avg_prep_time_min: formData.prepTime ? parseInt(formData.prepTime) : 30,
        min_order_value: formData.minOrder ? parseFloat(formData.minOrder) : 0,
        delivery_fee: formData.deliveryFee ? parseFloat(formData.deliveryFee) : 0,
        accepts_pix: formData.acceptsPix,
        accepts_card: formData.acceptsCard,
        accepts_cash: formData.acceptsCash,
        address_id: addressId,
        status: 'pending', 
        is_approved: false,
        commission_rate: 4,
        pix_key: formData.pixKey || null
      };

      if (finalBannerUrl) storeData.banner_url = finalBannerUrl;

      const { data: existingStore } = await supabase.from('stores').select('id').eq('owner_id', userId).maybeSingle();
      if (existingStore) {
        await supabase.from('stores').update(storeData).eq('id', existingStore.id);
      } else {
        const { error: storeErr } = await supabase.from('stores').insert(storeData);
        if (storeErr) throw new Error(`Erro ao criar loja: ${storeErr.message}`);
      }
    } 
    else if (registerRole === 'courier') {
      const courierData = {
        user_id: userId,
        cpf: cleanCpf,
        vehicle_type: formData.vehicleType,
        vehicle_brand: formData.vehicleBrand || null,
        vehicle_model: formData.vehicleModel || null,
        vehicle_year: formData.vehicleYear ? parseInt(formData.vehicleYear) : new Date().getFullYear(),
        license_plate: formData.licensePlate || null,
        pix_key: formData.pixKey || null,
        operation_city: formData.operationCity || formData.city,
        status: 'pending', 
        is_approved: false 
      };

      const { data: existingCourier } = await supabase.from('couriers').select('id').eq('user_id', userId).maybeSingle();
      if (existingCourier) {
        await supabase.from('couriers').update(courierData).eq('id', existingCourier.id);
      } else {
        const { error: courierErr } = await supabase.from('couriers').insert(courierData);
        if (courierErr) throw new Error(`Erro ao criar motoboy: ${courierErr.message}`);
      }
    }

    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      if (authMode === 'login') await handleLogin();
      else if (authMode === 'register') await handleRegister();
      else if (authMode === 'forgot_password') await handleForgotPassword();
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  if (showPendingApproval) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center" style={{paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))'}}>
        <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Clock size={48} />
        </div>
        <h2 className="text-2xl font-black text-brand-dark mb-2">Cadastro em Análise</h2>
        <p className="text-gray-600 mb-8 font-medium max-w-sm">Seu perfil está sendo analisado pela nossa equipe. Você terá acesso ao app assim que for aprovado!</p>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            setShowPendingApproval(false);
            setAuthMode('login');
          }}
          className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold w-full max-w-xs shadow-lg hover:bg-green-600 transition-colors"
        >
          Voltar ao Login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-white flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-8 border-4 border-gray-900" style={{paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingTop: 'env(safe-area-inset-top, 0px)'}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="flex-1 overflow-y-auto flex flex-col scrollbar-hide">
        <div className="pt-12 pb-6 px-6 flex flex-col items-center justify-center bg-brand-light/30 rounded-b-[3rem] shrink-0">
          <img src="https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/width_533-e0f65105-eff1-406d-acc8-d6ec9f3aa0a7.webp" alt="Logo" className="w-36 h-auto object-contain mb-4 drop-shadow-md" />
          
          {authMode === 'register' && (
            <div className="flex space-x-3 mb-4 mt-2">
              <button type="button" onClick={() => setRegisterRole('client')} className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all ${registerRole === 'client' ? 'bg-brand-primary text-white shadow-lg scale-105' : 'bg-white text-gray-400 border border-gray-200'}`}>
                <User size={24} className="mb-1" /><span className="text-xs font-bold">Cliente</span>
              </button>
              <button type="button" onClick={() => setRegisterRole('store')} className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all ${registerRole === 'store' ? 'bg-brand-primary text-white shadow-lg scale-105' : 'bg-white text-gray-400 border border-gray-200'}`}>
                <Store size={24} className="mb-1" /><span className="text-xs font-bold">Loja</span>
              </button>
              <button type="button" onClick={() => setRegisterRole('courier')} className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all ${registerRole === 'courier' ? 'bg-brand-primary text-white shadow-lg scale-105' : 'bg-white text-gray-400 border border-gray-200'}`}>
                <Bike size={24} className="mb-1" /><span className="text-xs font-bold">Motoboy</span>
              </button>
            </div>
          )}
          <h1 className="text-2xl font-black text-brand-dark text-center">
            {authMode === 'login' ? 'Bem-vindo de volta!' : 
             authMode === 'register' ? 'Crie sua conta' : 
             'Recuperar Senha'}
          </h1>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold mb-4 text-center border border-red-200 shadow-sm">{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            
            {authMode === 'login' && (
              <div className="space-y-4">
                <InputField icon={Mail} name="email" placeholder="Seu e-mail" type="email" required value={formData.email} onChange={handleChange} />
                <InputField icon={Lock} name="password" placeholder="Sua senha" type="password" required value={formData.password} onChange={handleChange} />
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setAuthMode('forgot_password'); setErrorMsg(''); }} className="text-sm text-brand-primary font-bold hover:underline">
                    Esqueci minha senha
                  </button>
                </div>
              </div>
            )}

            {authMode === 'forgot_password' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-center mb-4">Digite seu e-mail para receber um link de recuperação de senha.</p>
                <InputField icon={Mail} name="email" placeholder="Seu e-mail" type="email" required value={formData.email} onChange={handleChange} />
              </div>
            )}

            {authMode === 'register' && (
              <div className="space-y-2">
                {registerRole === 'client' && (
                  <div className="space-y-1">
                    <InputField icon={User} name="name" placeholder="Nome completo" required value={formData.name} onChange={handleChange} />
                    <InputField icon={FileText} name="cpf" placeholder="CPF" required value={formData.cpf} onChange={handleChange} maxLength={14} />
                    <InputField icon={Mail} name="email" placeholder="Seu e-mail" type="email" required value={formData.email} onChange={handleChange} />
                    <InputField icon={Lock} name="password" placeholder="Sua senha" type="password" required value={formData.password} onChange={handleChange} />
                  </div>
                )}
                
                {registerRole === 'store' && (
                  <>
                    <FormSection title="Dados da Empresa">
                      <InputField icon={Store} name="storeName" placeholder="Nome da loja" required value={formData.storeName} onChange={handleChange} />
                      <InputField icon={User} name="ownerName" placeholder="Nome do responsável" required value={formData.ownerName} onChange={handleChange} />
                      <InputField icon={FileText} name="cnpj" placeholder="CPF ou CNPJ" required value={formData.cnpj} onChange={handleChange} />
                      <InputField icon={Phone} name="phone" placeholder="Telefone / WhatsApp" required value={formData.phone} onChange={handleChange} />
                      <InputField icon={Mail} name="email" placeholder="E-mail de acesso" type="email" required value={formData.email} onChange={handleChange} />
                      <InputField icon={Lock} name="password" placeholder="Senha de acesso" type="password" required value={formData.password} onChange={handleChange} />
                    </FormSection>
                    <FormSection title="Informações da Loja">
                      
                      <div className="relative mb-3">
                        <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select 
                          name="category" 
                          required 
                          value={formData.category} 
                          onChange={handleChange} 
                          className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium text-brand-dark appearance-none"
                        >
                          <option value="" disabled>Selecione a categoria principal</option>
                          {globalCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <InputField icon={FileText} name="description" placeholder="Descrição curta da loja" value={formData.description} onChange={handleChange} />
                      
                      <div className="mt-4">
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
                                <span className="text-sm font-bold">Clique para enviar o banner</span>
                                <span className="text-xs mt-1">Max: 5MB</span>
                              </div>
                            )}
                          </label>
                          <input
                            id="banner-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleBannerChange}
                            className="hidden"
                          />
                          <p className="text-xs text-gray-500 mt-3 text-center">
                            Envie uma imagem de banner para sua loja (JPG, PNG, max 5MB).
                          </p>
                        </div>
                      </div>
                    </FormSection>
                    <FormSection title="Endereço da Loja">
                      <InputField icon={MapPin} name="cep" placeholder="CEP" required value={formData.cep} onChange={handleChange} />
                      <div className="flex space-x-2">
                        <div className="flex-[2]"><InputField name="street" placeholder="Rua" required value={formData.street} onChange={handleChange} /></div>
                        <div className="flex-1"><InputField name="number" placeholder="Número" required value={formData.number} onChange={handleChange} /></div>
                      </div>
                      <InputField name="complement" placeholder="Complemento" value={formData.complement} onChange={handleChange} />
                      <InputField name="neighborhood" placeholder="Bairro" required value={formData.neighborhood} onChange={handleChange} />
                      <div className="flex space-x-2">
                        <div className="flex-[2]"><InputField name="city" placeholder="Cidade" required value={formData.city} onChange={handleChange} /></div>
                        <div className="flex-1 relative mb-3">
                          <select name="state" required value={formData.state} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium text-brand-dark appearance-none">
                            <option value="" disabled>Estado</option>
                            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                      </div>
                    </FormSection>
                    <FormSection title="Operação e Taxas">
                      <InputField icon={Clock} name="prepTime" placeholder="Tempo médio de preparo (min)" type="number" value={formData.prepTime} onChange={handleChange} />
                      <InputField icon={DollarSign} name="minOrder" placeholder="Valor mínimo do pedido (R$)" type="number" value={formData.minOrder} onChange={handleChange} />
                      <InputField icon={Bike} name="deliveryFee" placeholder="Taxa base de entrega (R$)" type="number" value={formData.deliveryFee} onChange={handleChange} />
                    </FormSection>
                    <FormSection title="Dados Financeiros">
                      <InputField
                        icon={DollarSign}
                        name="pixKey"
                        placeholder="Chave PIX (CPF, e-mail, telefone ou aleatória)"
                        required
                        value={formData.pixKey}
                        onChange={handleChange}
                      />
                      <p className="text-xs text-gray-500 mt-1 px-1">
                        Os pagamentos digitais serão enviados toda segunda-feira para esta chave.
                      </p>
                    </FormSection>
                    <FormSection title="Formas de Pagamento Aceitas">
                      <div className="flex flex-col space-y-2">
                        <label className="flex items-center"><input type="checkbox" name="acceptsPix" checked={formData.acceptsPix} onChange={handleChange} className="mr-2" /> PIX (No app)</label>
                        <label className="flex items-center"><input type="checkbox" name="acceptsCard" checked={formData.acceptsCard} onChange={handleChange} className="mr-2" /> Cartão (No app)</label>
                        <label className="flex items-center"><input type="checkbox" name="acceptsCash" checked={formData.acceptsCash} onChange={handleChange} className="mr-2" /> Dinheiro (Na entrega)</label>
                      </div>
                    </FormSection>
                  </>
                )}

                {registerRole === 'courier' && (
                  <>
                    <FormSection title="Foto de Perfil (Selfie)">
                      <div className="flex flex-col items-center justify-center py-2">
                        <label htmlFor="camera-upload" className="w-32 h-32 rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative shadow-inner cursor-pointer hover:bg-gray-200 transition-colors">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center text-gray-400">
                              <Camera size={32} className="mb-1" />
                              <span className="text-[10px] font-bold uppercase text-center leading-tight px-2">Tirar<br/>Selfie</span>
                            </div>
                          )}
                        </label>
                        <input
                          id="camera-upload"
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                        <p className="text-xs text-gray-500 mt-3 text-center max-w-[250px]">
                          Toque acima para abrir a câmera e tirar uma foto do seu rosto.
                        </p>
                      </div>
                    </FormSection>
                    <FormSection title="Dados Pessoais">
                      <InputField icon={User} name="fullName" placeholder="Nome completo" required value={formData.fullName} onChange={handleChange} />
                      <InputField icon={FileText} name="cpf" placeholder="CPF" required value={formData.cpf} onChange={handleChange} />
                      <InputField icon={FileText} name="rg" placeholder="RG" value={formData.rg} onChange={handleChange} />
                      <InputField icon={Calendar} name="birthDate" placeholder="Data de Nascimento" type="date" value={formData.birthDate} onChange={handleChange} />
                      <InputField icon={Phone} name="phone" placeholder="Telefone / WhatsApp" required value={formData.phone} onChange={handleChange} />
                      <InputField icon={Mail} name="email" placeholder="E-mail de acesso" type="email" required value={formData.email} onChange={handleChange} />
                      <InputField icon={Lock} name="password" placeholder="Senha de acesso" type="password" required value={formData.password} onChange={handleChange} />
                    </FormSection>
                    <FormSection title="Endereço do Motoboy">
                      <InputField icon={MapPin} name="cep" placeholder="CEP" required value={formData.cep} onChange={handleChange} />
                      <div className="flex space-x-2">
                        <div className="flex-[2]"><InputField name="street" placeholder="Rua" required value={formData.street} onChange={handleChange} /></div>
                        <div className="flex-1"><InputField name="number" placeholder="Número" required value={formData.number} onChange={handleChange} /></div>
                      </div>
                      <InputField name="complement" placeholder="Complemento" value={formData.complement} onChange={handleChange} />
                      <InputField name="neighborhood" placeholder="Bairro" required value={formData.neighborhood} onChange={handleChange} />
                      <div className="flex space-x-2">
                        <div className="flex-[2]"><InputField name="city" placeholder="Cidade" required value={formData.city} onChange={handleChange} /></div>
                        <div className="flex-1 relative mb-3">
                          <select name="state" required value={formData.state} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium text-brand-dark appearance-none">
                            <option value="" disabled>Estado</option>
                            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                      </div>
                    </FormSection>
                    <FormSection title="Informações do Veículo">
                      <div className="relative mb-3">
                        <Bike className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium text-brand-dark appearance-none">
                          <option value="motorcycle">Moto</option>
                          <option value="bicycle">Bicicleta</option>
                          <option value="car">Carro</option>
                        </select>
                      </div>
                      {formData.vehicleType !== 'bicycle' && (
                        <>
                          <InputField name="vehicleBrand" placeholder="Marca (ex: Honda)" value={formData.vehicleBrand} onChange={handleChange} />
                          <InputField name="vehicleModel" placeholder="Modelo (ex: CG 160)" value={formData.vehicleModel} onChange={handleChange} />
                          <div className="flex space-x-2">
                            <div className="flex-1"><InputField name="vehicleYear" placeholder="Ano" type="number" value={formData.vehicleYear} onChange={handleChange} /></div>
                            <div className="flex-1"><InputField name="licensePlate" placeholder="Placa" value={formData.licensePlate} onChange={handleChange} /></div>
                          </div>
                        </>
                      )}
                    </FormSection>
                    <FormSection title="Dados Financeiros">
                      <InputField icon={DollarSign} name="pixKey" placeholder="Chave PIX para recebimento" required value={formData.pixKey} onChange={handleChange} />
                    </FormSection>
                    <FormSection title="Área de Atuação">
                      <InputField icon={Map} name="operationCity" placeholder="Cidade de atuação" required value={formData.operationCity} onChange={handleChange} />
                    </FormSection>
                  </>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className={`w-full bg-brand-primary text-white rounded-2xl py-4 font-bold text-lg shadow-lg shadow-brand-primary/30 hover:bg-green-600 transition-colors flex justify-center items-center mt-6 mb-4 shrink-0 ${loading ? 'opacity-70' : ''}`}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {authMode === 'login' ? 'Entrar' : 
                   authMode === 'register' ? 'Cadastrar' : 
                   'Enviar Link'} 
                  {(authMode === 'login' || authMode === 'forgot_password') ? <ArrowRight size={20} className="ml-2" /> : <CheckCircle size={20} className="ml-2" />}
                </>
              )}
            </button>
          </form>

          <div className="mt-auto text-center pt-4 border-t border-gray-100 shrink-0" style={{paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))'}}>
            {authMode === 'login' ? (
              <>
                <p className="text-gray-500 text-sm">Não tem uma conta?</p>
                <button onClick={() => { setAuthMode('register'); setRegisterRole('client'); setErrorMsg(''); }} className="mt-2 text-brand-dark font-bold text-base hover:text-brand-primary transition-colors">
                  Cadastre-se agora
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm">Já tem uma conta ou quer voltar?</p>
                <button onClick={() => { setAuthMode('login'); setErrorMsg(''); }} className="mt-2 text-brand-dark font-bold text-base hover:text-brand-primary transition-colors">
                  Voltar para o Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
