import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { Search, Loader2, AlertTriangle, CheckCircle2, Clock, Wrench, Eye, ShieldCheck, XCircle } from 'lucide-react';

interface ResultadoConsulta {
  ok: boolean;
  status: string;
  data: string;
  mensagem: string;
}

const STATUS_BADGE: Record<string, { label: string; mensagem: string; className: string; icon: React.ReactNode }> = {
  // Status legados (antes do módulo focos_risco)
  pendente: {
    label: 'Recebida',
    mensagem: 'Sua denúncia foi recebida e está aguardando análise pela equipe de vigilância.',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300',
    icon: <Clock className="w-4 h-4" />,
  },
  em_atendimento: {
    label: 'Em atendimento',
    mensagem: 'Uma equipe está atuando no local indicado.',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300',
    icon: <Wrench className="w-4 h-4" />,
  },
  // Status do módulo focos_risco (estado atual do sistema)
  suspeita: {
    label: 'Recebida',
    mensagem: 'Sua denúncia foi recebida e está na fila de análise. Agradecemos o contato!',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300',
    icon: <Clock className="w-4 h-4" />,
  },
  em_triagem: {
    label: 'Em análise',
    mensagem: 'Nossa equipe está analisando o local da denúncia. Em breve um agente será enviado.',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300',
    icon: <Eye className="w-4 h-4" />,
  },
  aguarda_inspecao: {
    label: 'Aguardando visita',
    mensagem: 'Um agente de campo será enviado ao local em breve para inspecionar o foco.',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300',
    icon: <Clock className="w-4 h-4" />,
  },
  confirmado: {
    label: 'Foco confirmado',
    mensagem: 'O foco de dengue foi confirmado no local. Nossa equipe está mobilizando o atendimento.',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  em_tratamento: {
    label: 'Em tratamento',
    mensagem: 'A equipe está realizando o tratamento no local. O foco está sendo eliminado.',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300',
    icon: <Wrench className="w-4 h-4" />,
  },
  resolvido: {
    label: 'Resolvido',
    mensagem: 'Foco eliminado com sucesso. Obrigado pela sua denúncia — ela fez a diferença!',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  descartado: {
    label: 'Analisada',
    mensagem: 'Nossos agentes visitaram o local e não identificaram foco ativo de dengue. Agradecemos a atenção!',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400 border-slate-300',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  // Fallback genérico
  cancelado: {
    label: 'Encerrada',
    mensagem: 'Esta denúncia foi encerrada.',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400 border-slate-300',
    icon: <XCircle className="w-4 h-4" />,
  },
};

const ConsultaProtocolo: React.FC = () => {
  const [protocolo, setProtocolo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = protocolo.trim();
    if (!p) return;

    setLoading(true);
    setResultado(null);
    setNaoEncontrado(false);

    try {
      const { data, error } = await supabase.rpc('consultar_denuncia_cidadao', {
        p_protocolo: p.toLowerCase(),
      });

      if (error) throw error;

      if (!data) {
        setNaoEncontrado(true);
      } else {
        setResultado(data as ResultadoConsulta);
      }
    } catch {
      setNaoEncontrado(true);
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = resultado ? (STATUS_BADGE[resultado.status] ?? null) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-login-panel px-4 py-5 flex items-center justify-center shadow-lg">
        <Logo className="text-2xl text-white" showIcon={false} />
      </header>

      <div className="flex-1 flex flex-col items-center justify-start p-4 pt-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-foreground">Consultar denúncia</h1>
            <p className="text-sm text-muted-foreground">
              Digite o protocolo recebido após registrar sua denúncia
            </p>
          </div>

          <form onSubmit={handleConsultar} className="space-y-4">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="protocolo">Número do protocolo</Label>
                  <Input
                    id="protocolo"
                    placeholder="Ex: A1B2C3D4"
                    value={protocolo}
                    onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="font-mono text-lg tracking-widest text-center uppercase"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Os primeiros 8 caracteres do código de atendimento
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              disabled={loading || protocolo.trim().length < 4}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Consultando...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" /> Consultar</>
              )}
            </Button>
          </form>

          {naoEncontrado && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-3 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Protocolo não encontrado. Verifique o código e tente novamente.</span>
            </div>
          )}

          {resultado && statusInfo && (
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                    Protocolo {protocolo.toUpperCase()}
                  </p>
                  <Badge
                    variant="outline"
                    className={`flex items-center gap-1.5 justify-center px-3 py-1.5 text-sm font-semibold ${statusInfo.className}`}
                  >
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  {resultado.mensagem || statusInfo.mensagem}
                </p>
                {resultado.data && (
                  <p className="text-xs text-muted-foreground text-center">
                    Registrado em: {new Date(resultado.data).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultaProtocolo;
