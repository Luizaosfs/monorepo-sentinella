import { useState, useEffect, useCallback } from 'react';
import { http } from '@sentinella/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlaFocoConfigItem {
  id?: string;
  fase: 'triagem' | 'inspecao' | 'confirmacao' | 'tratamento';
  prazoMinutos: number;
  ativo: boolean;
}

interface Props {
  clienteId: string | null;
}

const FASES: {
  key: SlaFocoConfigItem['fase'];
  label: string;
  desc: string;
  default: number;
}[] = [
  {
    key: 'triagem',
    label: 'Triagem',
    desc: 'Tempo máximo para avaliar o foco e encaminhar para inspeção (em_triagem → aguarda_inspecao).',
    default: 480,
  },
  {
    key: 'inspecao',
    label: 'Inspeção',
    desc: 'Tempo máximo para realizar a visita de inspeção no local (aguarda_inspecao → em_inspecao).',
    default: 720,
  },
  {
    key: 'confirmacao',
    label: 'Confirmação',
    desc: 'Tempo máximo para confirmar ou descartar o foco após inspeção (em_inspecao → confirmado).',
    default: 1440,
  },
  {
    key: 'tratamento',
    label: 'Tratamento',
    desc: 'Tempo máximo para concluir o tratamento após confirmação (confirmado → resolvido).',
    default: 2880,
  },
];

function minutesToLabel(min: number): string {
  if (min >= 1440 && min % 1440 === 0) return `${min / 1440} dia${min / 1440 > 1 ? 's' : ''}`;
  if (min >= 60 && min % 60 === 0) return `${min / 60}h`;
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}min`;
  return `${min}min`;
}

const DEFAULTS: Record<SlaFocoConfigItem['fase'], number> = {
  triagem: 480,
  inspecao: 720,
  confirmacao: 1440,
  tratamento: 2880,
};

export default function SlaFocoConfigTab({ clienteId }: Props) {
  const [configs, setConfigs] = useState<Record<SlaFocoConfigItem['fase'], SlaFocoConfigItem>>(
    () =>
      Object.fromEntries(
        FASES.map((f) => [f.key, { fase: f.key, prazoMinutos: f.default, ativo: true }]),
      ) as Record<SlaFocoConfigItem['fase'], SlaFocoConfigItem>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = useCallback(async () => {
    if (!clienteId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await http.get('/sla/foco-config') as SlaFocoConfigItem[];
      if (Array.isArray(data) && data.length > 0) {
        setConfigs((prev) => {
          const next = { ...prev };
          for (const item of data) {
            if (item.fase in next) next[item.fase] = item;
          }
          return next;
        });
      }
    } catch {
      // sem config ainda — usa defaults
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await http.put('/sla/foco-config', {
        configs: Object.values(configs).map(({ fase, prazoMinutos, ativo }) => ({
          fase,
          prazoMinutos,
          ativo,
        })),
      });
      toast.success('Configuração de fases SLA salva com sucesso.');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfigs(
      Object.fromEntries(
        FASES.map((f) => [f.key, { fase: f.key, prazoMinutos: f.default, ativo: true }]),
      ) as Record<SlaFocoConfigItem['fase'], SlaFocoConfigItem>,
    );
    toast.info('Valores padrão restaurados. Clique em Salvar para confirmar.');
  };

  const setMinutos = (fase: SlaFocoConfigItem['fase'], value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return;
    setConfigs((prev) => ({ ...prev, [fase]: { ...prev[fase], prazoMinutos: num } }));
  };

  const toggleAtivo = (fase: SlaFocoConfigItem['fase']) => {
    setConfigs((prev) => ({ ...prev, [fase]: { ...prev[fase], ativo: !prev[fase].ativo } }));
  };

  if (!clienteId) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Selecione um cliente para configurar os prazos por fase.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prazos por Fase Operacional</CardTitle>
          <CardDescription>
            Define o tempo máximo de cada etapa do ciclo de vida do foco de risco.
            Esses prazos compõem o <strong>Índice Sanitário (ISTI)</strong> — quanto mais próximo do vencimento,
            maior a pontuação de urgência do foco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FASES.map((f, idx) => {
            const cfg = configs[f.key];
            const isDefault = cfg.prazoMinutos === DEFAULTS[f.key];
            return (
              <div key={f.key}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Label + desc */}
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    <span className="font-medium text-sm">{f.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[240px] text-xs leading-relaxed">
                        {f.desc}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Input minutos */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground sr-only">Minutos</Label>
                    <Input
                      type="number"
                      min={1}
                      value={cfg.prazoMinutos}
                      onChange={(e) => setMinutos(f.key, e.target.value)}
                      className={cn('w-28 h-8 text-sm', !cfg.ativo && 'opacity-50')}
                      disabled={!cfg.ativo}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>

                  {/* Legível */}
                  <Badge variant="outline" className={cn('text-xs shrink-0', !cfg.ativo && 'opacity-40')}>
                    {minutesToLabel(cfg.prazoMinutos)}
                  </Badge>

                  {!isDefault && (
                    <Badge variant="secondary" className="text-xs shrink-0">personalizado</Badge>
                  )}

                  {/* Toggle ativo */}
                  <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor={`ativo-${f.key}`} className="text-xs text-muted-foreground">Ativo</Label>
                    <Switch
                      id={`ativo-${f.key}`}
                      checked={cfg.ativo}
                      onCheckedChange={() => toggleAtivo(f.key)}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <Separator />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrões
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
