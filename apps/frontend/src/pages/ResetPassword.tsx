import { useState, useEffect } from 'react';
import { http } from '@sentinella/api-client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    // Token vem como query param ?token=... ou no hash #access_token=...
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') ?? new URLSearchParams(window.location.hash.replace('#', '')).get('access_token');
    if (token) {
      setResetToken(token);
      setValidSession(true);
    } else {
      setValidSession(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await http.post('/auth/reset-password', { token: resetToken, newPassword: password });
      setDone(true);
      toast.success('Senha redefinida com sucesso!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao redefinir senha');
    } finally {
      setSaving(false);
    }
  };

  if (validSession === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (validSession === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md rounded-xl border-2 border-cardBorder shadow-lg">
          <CardContent className="p-6 text-center space-y-4">
            <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
            <p className="text-sm text-muted-foreground">
              O link de redefinição de senha é inválido ou já expirou. Solicite um novo link ao administrador.
            </p>
            <Button onClick={() => navigate('/login')}>Voltar ao login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md rounded-xl border-2 border-cardBorder shadow-lg">
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-lg font-semibold">Senha redefinida!</h2>
            <p className="text-sm text-muted-foreground">
              Sua senha foi alterada com sucesso. Você já pode fazer login.
            </p>
            <Button onClick={() => navigate('/login')}>Ir para o login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md rounded-xl border-2 border-cardBorder shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Redefinir Senha</h2>
            <p className="text-sm text-muted-foreground">Digite sua nova senha abaixo.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              Redefinir Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
