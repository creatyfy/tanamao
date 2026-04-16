import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Loader2, CheckCircle } from 'lucide-react';

interface Props {
  onDone: () => void;
}

export default function ResetPasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setDone(true);
      setTimeout(onDone, 2500);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-md mx-auto h-screen bg-white flex flex-col items-center justify-center p-6"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {done ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle size={64} className="text-brand-primary mb-4" />
          <h2 className="text-2xl font-black text-brand-dark mb-2">Senha redefinida!</h2>
          <p className="text-gray-500 text-sm">Redirecionando para o login...</p>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mb-6">
            <Lock size={28} className="text-brand-primary" />
          </div>
          <h2 className="text-2xl font-black text-brand-dark mb-2">Nova senha</h2>
          <p className="text-gray-500 text-sm text-center mb-8">
            Digite e confirme sua nova senha abaixo.
          </p>

          <input
            type="password"
            placeholder="Nova senha (mín. 6 caracteres)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-brand-primary outline-none mb-3"
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-brand-primary outline-none mb-4"
          />

          {error && (
            <p className="text-red-500 text-sm font-medium mb-4 text-center">{error}</p>
          )}

          <button
            onClick={handleReset}
            disabled={loading || !password || !confirm}
            className="w-full bg-brand-primary text-white rounded-2xl py-4 font-bold text-base flex justify-center items-center disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Redefinir senha'}
          </button>
        </>
      )}
    </div>
  );
}
