import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Mail, Lock, User, ArrowRight, Store, Bike, 
  FileText, CheckCircle, Loader2, Phone, MapPin, DollarSign,
  Clock, Map, CreditCard, Calendar
} from 'lucide-react';

const InputField = ({ icon: Icon, placeholder, type = "text", required = false, name, value, onChange }: any) => (
  <div className="relative mb-3">
    {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />}
    <input 
      type={type} 
      name={name}
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

export default function MobileAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [registerRole, setRegisterRole] = useState<'client' | 'store' | 'courier'>('client');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Estado unificado para todos os campos do formulário
  const [formData, setFormData] = useState({
    // Comum
    email: '', password: '', phone: '',
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
    // Cliente
    name: '',
    // Loja
    storeName: '', ownerName: '', cnpj: '', description: '', category: '', prepTime: '', minOrder: '', deliveryFee: '',
    acceptsPix: true, acceptsCard: true, acceptsCash: false,
    // Motoboy
    fullName: '', cpf: '', rg: '', birthDate: '', vehicleType: 'moto', vehicleBrand: '', vehicleModel: '', vehicleYear: '', licensePlate: '', pixKey: '', operationCity: ''
  });

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAuthError = (err: any) => {
    console.error("Auth Error Details:", err);
    let msg = err.message || 'Ocorreu um erro inesperado.';
    if (msg.includes('Invalid login credentials')) msg = 'E-mail ou senha incorretos.';
    else if (msg.includes('User already registered')) msg = 'Este e-mail já está cadastrado.';
    else if (msg.includes('rate limit')) msg = 'Muitas tentativas. Aguarde um momento.';
    setErrorMsg(msg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) throw error;
      } else {
        const roleMap: Record<string, string> = { client: 'client', store: 'store_owner', courier: 'courier' };
        const userName = registerRole === 'store' ? formData.ownerName : (registerRole === 'courier' ? formData.fullName : formData.name);

        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { name: userName, role: roleMap[registerRole] } }
        });
        if (error) throw error;

        if (data.user) {
          const userId = data.user.id;

          // 1. Criar Usuário
          const { error: userErr } = await supabase.from('users').insert({
            id: userId,
            name: userName || formData.email.split('@')[0],
            email: formData.email,
            phone: formData.phone,
            role: roleMap[registerRole],
            is_active: registerRole === 'client'
          });
          if (userErr && !userErr.message.includes('duplicate key')) throw userErr;

          // 2. Criar Endereço (Para Loja e Motoboy)
          let addressId = null;
          if (registerRole === 'store' || registerRole === 'courier') {
            const { data: addrData, error: addrErr } = await supabase.from('addresses').insert({
              user_id: userId,
              street: formData.street || 'Não informado',
              number: formData.number || 'S/N',
              complement: formData.complement,
              neighborhood: formData.neighborhood || 'Não informado',
              city: formData.city || 'Não informado',
              state: formData.state || 'SP',
              zip_code: formData.cep || '00000000'
            }).select().single();
            if (!addrErr && addrData) addressId = addrData.id;
          }

          // 3. Criar Loja
          if (registerRole === 'store') {
            const { error: storeErr } = await supabase.from('stores').insert({
              owner_id: userId,
              name: formData.storeName || 'Nova Loja',
              slug: `loja-${Date.now()}`,
              cnpj: formData.cnpj,
              phone: formData.phone,
              description: formData.description,
              avg_prep_time_min: parseInt(formData.prepTime) || 30,
              min_order_value: parseFloat(formData.minOrder) || 0,
              delivery_fee: parseFloat(formData.deliveryFee) || 0,
              accepts_pix: formData.acceptsPix,
              accepts_card: formData.acceptsCard,
              accepts_cash: formData.acceptsCash,
              address_id: addressId,
              status: 'pending',
              is_approved: false
            });
            if (storeErr) throw storeErr;
            
            alert('Cadastro de Loja enviado com sucesso! Aguarde a aprovação do administrador.');
            await supabase.auth.signOut();
            setIsLogin(true);
          } 
          
          // 4. Criar Motoboy
          else if (registerRole === 'courier') {
            const { error: courierErr } = await supabase.from('couriers').insert({
              user_id: userId,
              cpf: formData.cpf || '00000000000',
              vehicle_type: formData.vehicleType,
              vehicle_brand: formData.vehicleBrand,
              vehicle_model: formData.vehicleModel,
              vehicle_year: parseInt(formData.vehicleYear) || new Date().getFullYear(),
              license_plate: formData.licensePlate,
              pix_key: formData.pixKey,
              operation_city: formData.operationCity || formData.city,
              status: 'pending',
              is_approved: false
            });
            if (courierErr) throw courierErr;
            
            alert('Cadastro de Motoboy enviado com sucesso! Aguarde a aprovação do administrador.');
            await supabase.auth.signOut();
            setIsLogin(true);
          }
        }
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async (testEmail: string, role: string) => {
    setLoading(true);
    setErrorMsg('');
    const testPassword = '123456';

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: testEmail, password: testPassword, options: { data: { name: `Teste ${role}`, role } }
          });
          if (signUpError) throw signUpError;

          if (signUpData.user) {
            const userId = signUpData.user.id;
            await supabase.from('users').insert({ id: userId, name: `Teste ${role}`, email: testEmail, role: role, is_active: true });

            if (role === 'store_owner') {
              await supabase.from('stores').insert({ owner_id: userId, name: 'Loja de Teste', slug: `loja-teste-${Date.now()}`, status: 'active', is_approved: true, is_open: true });
            } else if (role === 'courier') {
              await supabase.from('couriers').insert({ user_id: userId, cpf: '00000000000', vehicle_type: 'moto', status: 'active', is_approved: true });
            }
            await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
          }
        } else {
          throw signInError;
        }
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-white flex flex-col relative shadow-2xl overflow-hidden sm:rounded-3xl sm:h-[850px] sm:my-8 border-4 border-gray-900">
      <div className="flex-1 overflow-y-auto flex flex-col scrollbar-hide">
        <div className="pt-12 pb-6 px-6 flex flex-col items-center justify-center bg-brand-light/30 rounded-b-[3rem] shrink-0">
          <img src="https://images.dualite.app/d52f60de-2692-4885-8c36-cb03ccdd56d7/width_533-e0f65105-eff1-406d-acc8-d6ec9f3aa0a7.webp" alt="Logo" className="w-36 h-auto object-contain mb-4 drop-shadow-md" />
          
          {!isLogin && (
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
          <h1 className="text-2xl font-black text-brand-dark text-center">{isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}</h1>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          {errorMsg && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm font-bold mb-4 text-center border border-red-100">{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            {isLogin ? (
              <div className="space-y-4">
                <InputField icon={Mail} name="email" placeholder="Seu e-mail" type="email" required value={formData.email} onChange={handleChange} />
                <InputField icon={Lock} name="password" placeholder="Sua senha" type="password" required value={formData.password} onChange={handleChange} />
                
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <p className="text-xs font-bold text-gray-400 text-center mb-3 uppercase tracking-wider">Acesso Rápido (Testes)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => handleTestLogin('cliente@teste.com', 'client')} disabled={loading} className="py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 border border-gray-200 flex items-center justify-center"><User size={16} className="mr-2" /> Cliente</button>
                    <button type="button" onClick={() => handleTestLogin('loja@teste.com', 'store_owner')} disabled={loading} className="py-3 bg-brand-light text-brand-primary rounded-xl text-sm font-bold hover:bg-green-100 border border-brand-primary/20 flex items-center justify-center"><Store size={16} className="mr-2" /> Loja</button>
                    <button type="button" onClick={() => handleTestLogin('motoboy@teste.com', 'courier')} disabled={loading} className="py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 border border-gray-200 flex items-center justify-center"><Bike size={16} className="mr-2" /> Motoboy</button>
                    <button type="button" onClick={() => handleTestLogin('admin@teste.com', 'admin')} disabled={loading} className="py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 border border-gray-200 flex items-center justify-center"><Lock size={16} className="mr-2" /> Admin</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {registerRole === 'client' && (
                  <div className="space-y-1">
                    <InputField icon={User} name="name" placeholder="Nome completo" required value={formData.name} onChange={handleChange} />
                    <InputField icon={Mail} name="email" placeholder="Seu e-mail" type="email" required value={formData.email} onChange={handleChange} />
                    <InputField icon={Lock} name="password" placeholder="Sua senha" type="password" required value={formData.password} onChange={handleChange} />
                  </div>
                )}
                
                {registerRole === 'store' && (
                  <>
                    <FormSection title="Dados do Negócio">
                      <InputField icon={Store} name="storeName" placeholder="Nome da loja" required value={formData.storeName} onChange={handleChange} />
                      <InputField icon={User} name="ownerName" placeholder="Nome do responsável" required value={formData.ownerName} onChange={handleChange} />
                      <InputField icon={FileText} name="cnpj" placeholder="CPF ou CNPJ" required value={formData.cnpj} onChange={handleChange} />
                      <InputField icon={Phone} name="phone" placeholder="Telefone / WhatsApp" required value={formData.phone} onChange={handleChange} />
                      <InputField icon={Mail} name="email" placeholder="E-mail de acesso" type="email" required value={formData.email} onChange={handleChange} />
                      <InputField icon={Lock} name="password" placeholder="Senha de acesso" type="password" required value={formData.password} onChange={handleChange} />
                    </FormSection>
                    <FormSection title="Informações da Loja">
                      <InputField icon={Store} name="category" placeholder="Categoria (ex: Pizza, Lanches)" value={formData.category} onChange={handleChange} />
                      <InputField icon={FileText} name="description" placeholder="Descrição curta da loja" value={formData.description} onChange={handleChange} />
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
                        <div className="flex-1"><InputField name="state" placeholder="Estado (UF)" required value={formData.state} onChange={handleChange} /></div>
                      </div>
                    </FormSection>
                    <FormSection title="Operação e Taxas">
                      <InputField icon={Clock} name="prepTime" placeholder="Tempo médio de preparo (min)" type="number" value={formData.prepTime} onChange={handleChange} />
                      <InputField icon={DollarSign} name="minOrder" placeholder="Valor mínimo do pedido (R$)" type="number" value={formData.minOrder} onChange={handleChange} />
                      <InputField icon={Bike} name="deliveryFee" placeholder="Taxa de entrega base (R$)" type="number" value={formData.deliveryFee} onChange={handleChange} />
                    </FormSection>
                    <FormSection title="Formas de Pagamento Aceitas">
                      <div className="flex flex-col space-y-2">
                        <label className="flex items-center"><input type="checkbox" name="acceptsPix" checked={formData.acceptsPix} onChange={handleChange} className="mr-2" /> PIX (App)</label>
                        <label className="flex items-center"><input type="checkbox" name="acceptsCard" checked={formData.acceptsCard} onChange={handleChange} className="mr-2" /> Cartão (App)</label>
                        <label className="flex items-center"><input type="checkbox" name="acceptsCash" checked={formData.acceptsCash} onChange={handleChange} className="mr-2" /> Dinheiro (Na entrega)</label>
                      </div>
                    </FormSection>
                  </>
                )}

                {registerRole === 'courier' && (
                  <>
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
                      <InputField name="neighborhood" placeholder="Bairro" required value={formData.neighborhood} onChange={handleChange} />
                      <div className="flex space-x-2">
                        <div className="flex-[2]"><InputField name="city" placeholder="Cidade" required value={formData.city} onChange={handleChange} /></div>
                        <div className="flex-1"><InputField name="state" placeholder="Estado (UF)" required value={formData.state} onChange={handleChange} /></div>
                      </div>
                    </FormSection>
                    <FormSection title="Informações do Veículo">
                      <div className="relative mb-3">
                        <Bike className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium text-brand-dark appearance-none">
                          <option value="moto">Moto</option>
                          <option value="bicicleta">Bicicleta</option>
                          <option value="carro">Carro</option>
                        </select>
                      </div>
                      {formData.vehicleType !== 'bicicleta' && (
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
                      <InputField icon={Map} name="operationCity" placeholder="Cidade onde deseja trabalhar" required value={formData.operationCity} onChange={handleChange} />
                    </FormSection>
                  </>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className={`w-full bg-brand-primary text-white rounded-2xl py-4 font-bold text-lg shadow-lg shadow-brand-primary/30 hover:bg-green-600 transition-colors flex justify-center items-center mt-6 mb-4 shrink-0 ${loading ? 'opacity-70' : ''}`}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>{isLogin ? 'Entrar' : registerRole === 'client' ? 'Cadastrar' : 'Enviar para Aprovação'} {isLogin ? <ArrowRight size={20} className="ml-2" /> : <CheckCircle size={20} className="ml-2" />}</>
              )}
            </button>
          </form>

          <div className="mt-auto text-center pt-4 border-t border-gray-100 shrink-0">
            <p className="text-gray-500 text-sm">{isLogin ? "Ainda não tem uma conta?" : "Já tem uma conta?"}</p>
            <button onClick={() => { setIsLogin(!isLogin); setRegisterRole('client'); setErrorMsg(''); }} className="mt-2 text-brand-dark font-bold text-base hover:text-brand-primary transition-colors">
              {isLogin ? "Cadastre-se agora" : "Faça login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
