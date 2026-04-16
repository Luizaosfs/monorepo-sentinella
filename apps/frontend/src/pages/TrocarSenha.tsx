import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react';

const TrocarSenha = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const logTelemetry = (step: string, payload: Record<string, unknown>) => {
    console.info('[TrocarSenha][telemetria]', {
      step,
      at: new Date().toISOString(),
      ...payload,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Informe sua senha atual para validar a sessão');
      return;
    }

    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error('A senha deve conter pelo menos uma letra maiúscula');
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error('A senha deve conter pelo menos um número');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      toast.error('A senha deve conter pelo menos um caractere especial (!@#$%...)');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSaving(true);
    try {
      logTelemetry('submit:start', {
        hasCurrentPassword: Boolean(currentPassword),
        newPasswordLength: password.length,
        confirmMatches: password === confirm,
      });

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      logTelemetry('getSession', {
        hasSession: Boolean(sessionData.session),
        error: sessionError?.message ?? null,
        mustChangePassword: sessionData.session?.user?.user_metadata?.must_change_password ?? null,
      });

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser?.email) {
        throw new Error('Sessão inválida. Faça login novamente.');
      }

      // Reautentica para garantir uma sessão ativa no auth
      const { data: reloginData, error: reloginError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });
      logTelemetry('signInWithPassword', {
        ok: !reloginError,
        error: reloginError?.message ?? null,
        hasSession: Boolean(reloginData.session),
        mustChangePassword: reloginData.user?.user_metadata?.must_change_password ?? null,
      });
      if (reloginError) {
        throw new Error('Senha atual inválida. Faça login novamente e tente de novo.');
      }

      // Atualiza senha + metadado em uma única chamada
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });
      logTelemetry('updateUser', {
        ok: !updateError,
        error: updateError?.message ?? null,
        mustChangePassword: updateData.user?.user_metadata?.must_change_password ?? null,
      });
      if (updateError) throw updateError;

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      logTelemetry('refreshSession', {
        ok: !refreshError,
        error: refreshError?.message ?? null,
        mustChangePassword: refreshData.session?.user?.user_metadata?.must_change_password ?? null,
      });

      toast.success('Senha alterada com sucesso!');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar senha';
      logTelemetry('submit:catch', { message: msg });
      if (msg.toLowerCase().includes('auth session missing') || msg.toLowerCase().includes('session_not_found')) {
        await supabase.auth.signOut({ scope: 'local' });
        toast.error('Sua sessão expirou. Faça login novamente.');
        navigate('/login', { replace: true });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-background p-4">
      <Card className="w-full max-w-md rounded-xl border-2 border-cardBorder shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Alterar Senha</h2>
              <p className="text-sm text-muted-foreground">
                É necessário criar uma nova senha antes de continuar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Senha Atual</Label>
              <Input
                type={showPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 8 chars, maiúscula, número e especial"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 caractere especial.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Nova Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrocarSenha;
