import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isPasswordRecovery: false,
  signOut: async () => {},
  deleteAccount: async () => {},
  clearRecovery: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Função auxiliar para limpar a sessão local em caso de erro
  const clearSession = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                             error instanceof TypeError;
      if (isNetworkError) {
        console.warn('Aviso: Falha de conexão com o Supabase.');
        clearSession();
      } else {
        console.error('Erro ao buscar perfil:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Verifica se o email do usuário foi confirmado
  const isEmailConfirmed = (user: User) => {
    return !!user.email_confirmed_at;
  };

  useEffect(() => {
    // Tenta recuperar a sessão atual
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Erro na sessão:", error.message);
        clearSession();
        return;
      }

      // Bloqueia sessão se email não confirmado
      if (session?.user && !isEmailConfirmed(session.user)) {
        console.warn('Email não confirmado. Bloqueando sessão.');
        supabase.auth.signOut();
        clearSession();
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Erro crítico ao obter sessão:", err);
      clearSession();
    });

    // Escuta mudanças de estado da autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESH_FAILED' || event === 'SIGNED_OUT') {
        clearSession();
        return;
      }

      // Bloqueia login se email não confirmado
      if (session?.user && !isEmailConfirmed(session.user)) {
        console.warn('Email não confirmado. Bloqueando login.');
        supabase.auth.signOut();
        clearSession();
        return;
      }

      setTimeout(async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Erro de rede ao sair:', error);
    } finally {
      clearSession();
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      await supabase
        .from('users')
        .update({
          is_active: false,
          name: 'Conta Excluída',
          phone: null,
          avatar_url: null,
        })
        .eq('id', user.id);
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Erro ao excluir conta:', error);
    } finally {
      clearSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPasswordRecovery, signOut, deleteAccount, clearRecovery }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
