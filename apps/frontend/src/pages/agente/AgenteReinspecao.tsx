/**
 * AgenteReinspecao — Página de execução da reinspeção pelo agente.
 *
 * Rota: /agente/reinspecao/:reinspecaoId
 *
 * Fluxo:
 *   1. Agente abre a reinspeção via card em AgenteHoje
 *   2. Registra resultado (resolvido / persiste / nao_realizado)
 *   3. Se resultado = 'resolvido' e pode_resolver_foco=true, oferece botão para
 *      navegar para /agente/focos/:id e encerrar o foco diretamente
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertCircle, HelpCircle, MapPin,
  CalendarClock, ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useReinspecoesByFoco } from '@/hooks/queries/useReinspecoes';
import { useRegistrarResultadoReinspecaoMutation } from '@/hooks/queries/useReinspecoes';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryConfig';
import { cn } from '@/lib/utils';
import { LABEL_REINSPECAO_TIPO } from '@/types/database';
import type { ReinspecaoResultado } from '@/types/database';

// ── Opções de resultado ───────────────────────────────────────────────────────

const RESULTADO_OPTIONS: {
  value: ReinspecaoResultado;
  label: string;
  descricao: string;
  icon: React.ElementType;
  colorClass: string;
}[] = [
  {
    value: 'resolvido',
    label: 'Problema resolvido',
    descricao: 'O tratamento foi eficaz. O foco foi eliminado.',
    icon: CheckCircle2,
    colorClass: 'border-green-400 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400',
  },
  {
    value: 'persiste',
    label: 'Problema persiste',
    descricao: 'O foco ainda está presente. É necessário novo tratamento.',
    icon: AlertCircle,
    colorClass: 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
  },
  {
    value: 'nao_realizado',
    label: 'Não foi possível realizar',
    descricao: 'Acesso negado, imóvel fechado ou outro impedimento.',
    icon: HelpCircle,
    colorClass: 'border-gray-300 bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400',
  },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function AgenteReinspecao() {
  const { reinspecaoId } = useParams<{ reinspecaoId: string }>();
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();

  const [resultado, setResultado] = useState<ReinspecaoResultado | null>(null);
  const [observacao, setObservacao] = useState('');
  const [concluido, setConcluido] = useState(false);
  const [focoIdParaResolver, setFocoIdParaResolver] = useState<string | null>(null);

  const registrar = useRegistrarResultadoReinspecaoMutation();

  // Busca a reinspeção diretamente pelo id
  const { data: reinspecao, isLoading } = useQuery({
    queryKey: ['reinspecao-single', reinspecaoId],
    queryFn: () => api.reinspecoes.getById(reinspecaoId!),
    enabled: !!reinspecaoId,
    staleTime: STALE.SHORT,
  });

  const foco = reinspecao?.foco as Record<string, unknown> | null;
  const imovel = foco?.imovel as Record<string, string> | null;
  const endereco = imovel
    ? [imovel.logradouro, imovel.numero, imovel.bairro].filter(Boolean).join(', ')
    : (foco?.endereco_normalizado as string) ?? 'Endereço não informado';

  async function handleSubmit() {
    if (!resultado || !reinspecaoId || !reinspecao) return;

    try {
      const res = await registrar.mutateAsync({
        reinspecaoId,
        focoRiscoId: reinspecao.foco_risco_id as string,
        resultado,
        observacao: observacao.trim() || undefined,
      });

      if (res.ok) {
        if (res.pode_resolver_foco && res.foco_id) {
          setFocoIdParaResolver(res.foco_id);
        }
        setConcluido(true);
        toast.success('Reinspeção registrada com sucesso.');
      } else {
        toast.error(res.error ?? 'Erro ao registrar resultado.');
      }
    } catch {
      toast.error('Falha ao registrar resultado. Tente novamente.');
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!reinspecao) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Reinspeção não encontrada.
      </div>
    );
  }

  // ── Tela de conclusão ────────────────────────────────────────────────────────

  if (concluido) {
    const opcaoSelecionada = RESULTADO_OPTIONS.find(o => o.value === resultado);
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto space-y-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <ClipboardCheck className="w-8 h-8 text-green-600" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Reinspeção registrada</h2>
          {opcaoSelecionada && (
            <p className="text-sm text-muted-foreground">{opcaoSelecionada.label}</p>
          )}
        </div>

        {focoIdParaResolver ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 p-4 text-left space-y-2">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                Tratamento eficaz confirmado
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">
                O resultado foi registrado. Acesse o foco para encerrá-lo como resolvido.
              </p>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => navigate(`/agente/focos/${focoIdParaResolver}`)}
            >
              Ver foco e encerrar
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/agente/hoje')}
            >
              Voltar para hoje
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/agente/hoje')}
          >
            Voltar para hoje
          </Button>
        )}
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-lg font-bold">Executar Reinspeção</h1>
        <p className="text-sm text-muted-foreground">
          {LABEL_REINSPECAO_TIPO[reinspecao.tipo as keyof typeof LABEL_REINSPECAO_TIPO]}
        </p>
      </div>

      {/* Info do foco */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{endereco}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="w-3.5 h-3.5 shrink-0" />
          <span>
            Prevista para:{' '}
            {new Date(reinspecao.data_prevista as string).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        {reinspecao.status === 'vencida' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
            Reinspeção vencida
          </span>
        )}
      </div>

      {/* Seleção de resultado */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Resultado da vistoria <span className="text-destructive">*</span></Label>
        <div className="space-y-2">
          {RESULTADO_OPTIONS.map((op) => {
            const Icon = op.icon;
            const selected = resultado === op.value;
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => setResultado(op.value)}
                className={cn(
                  'w-full rounded-lg border-2 p-3 text-left transition-all',
                  selected ? op.colorClass + ' border-current' : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', selected ? '' : 'text-muted-foreground')} />
                  <div>
                    <p className="text-sm font-semibold">{op.label}</p>
                    <p className={cn('text-xs mt-0.5', selected ? 'opacity-80' : 'text-muted-foreground')}>
                      {op.descricao}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Observação */}
      <div className="space-y-2">
        <Label htmlFor="obs" className="text-sm font-semibold">Observação (opcional)</Label>
        <Textarea
          id="obs"
          placeholder="Descreva o que foi encontrado, ações realizadas..."
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Botão */}
      <Button
        className="w-full"
        size="lg"
        disabled={!resultado || registrar.isPending}
        onClick={handleSubmit}
      >
        {registrar.isPending ? 'Registrando...' : 'Confirmar reinspeção'}
      </Button>
    </div>
  );
}
