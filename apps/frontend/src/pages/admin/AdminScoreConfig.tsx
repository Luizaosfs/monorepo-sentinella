import { useState, useEffect } from 'react';
import { Settings2, RotateCcw, Save, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import AdminPageHeader from '@/components/AdminPageHeader';
import { useScoreConfig, useUpsertScoreConfig } from '@/hooks/queries/useScoreTerritorial';
import type { ScoreConfig } from '@/hooks/queries/useScoreTerritorial';

const DEFAULT_CONFIG: Partial<ScoreConfig> = {
  peso_foco_suspeito: 10,
  peso_foco_confirmado: 25,
  peso_foco_em_tratamento: 20,
  peso_foco_recorrente: 35,
  peso_historico_3focos: 15,
  peso_caso_300m: 25,
  peso_chuva_alta: 10,
  peso_temperatura_30: 8,
  peso_denuncia_cidadao: 10,
  peso_imovel_recusa: 8,
  peso_sla_vencido: 12,
  peso_foco_resolvido: -15,
  peso_vistoria_negativa: -8,
  janela_resolucao_dias: 30,
  janela_vistoria_dias: 45,
  janela_caso_dias: 60,
  cap_focos: 40,
  cap_epidemio: 30,
  cap_historico: 20,
};

interface SliderFieldProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  positive?: boolean;
}

function SliderField({ label, description, value, min, max, step = 1, onChange, positive = true }: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Badge
          variant="outline"
          className={positive || value >= 0
            ? 'text-emerald-700 border-emerald-300 bg-emerald-50 font-bold tabular-nums min-w-[3rem] justify-center'
            : 'text-red-700 border-red-300 bg-red-50 font-bold tabular-nums min-w-[3rem] justify-center'
          }
        >
          {value >= 0 ? '+' : ''}{value}
        </Badge>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

export default function AdminScoreConfig() {
  const { toast } = useToast();
  const { data: savedConfig, isLoading } = useScoreConfig();
  const { mutate: upsertConfig, isPending } = useUpsertScoreConfig();
  const [config, setConfig] = useState<Partial<ScoreConfig>>(DEFAULT_CONFIG);

  useEffect(() => {
    if (savedConfig) setConfig(savedConfig);
  }, [savedConfig]);

  const set = <K extends keyof ScoreConfig>(key: K, value: ScoreConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => setConfig(DEFAULT_CONFIG);

  const handleSave = () => {
    upsertConfig(config, {
      onSuccess: () => toast({ title: 'Configuração salva', description: 'Os pesos do score foram atualizados.' }),
      onError: (e) => toast({ title: 'Erro ao salvar', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  // Preview simplificado: 1 foco confirmado + 1 caso próximo
  const previewScore = Math.min(100, Math.max(0,
    (config.peso_foco_confirmado ?? 25) + (config.peso_caso_300m ?? 25)
  ));

  if (isLoading) return (
    <div className="space-y-6">
      <AdminPageHeader title="Config. Score Territorial" description="Calibrando pesos..." icon={Settings2} />
      <div className="grid gap-4 md:grid-cols-2">
        {[1,2,3,4].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <AdminPageHeader
        title="Configurar Score Territorial"
        description="Ajuste os pesos conforme a realidade epidemiológica do seu município"
        icon={Settings2}
      />

      {/* Preview */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-4">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Preview do score</p>
            <p className="text-xs text-muted-foreground">
              Um imóvel com 1 foco confirmado + 1 caso notificado em 300m = <strong>{previewScore} pontos</strong>
            </p>
          </div>
          <Badge className="text-base font-bold px-3 py-1">{previewScore} pts</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Focos ativos */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Focos ativos</CardTitle>
            <CardDescription className="text-xs">Pontos adicionados por focos no imóvel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField label="Foco suspeito" value={config.peso_foco_suspeito ?? 10} min={0} max={30} onChange={(v) => set('peso_foco_suspeito', v)} />
            <SliderField label="Foco confirmado" value={config.peso_foco_confirmado ?? 25} min={0} max={50} onChange={(v) => set('peso_foco_confirmado', v)} />
            <SliderField label="Foco recorrente" description="Imóvel com histórico (foco_anterior_id)" value={config.peso_foco_recorrente ?? 35} min={0} max={60} onChange={(v) => set('peso_foco_recorrente', v)} />
            <Separator className="bg-border/60" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cap de focos</p>
            <SliderField label="Máximo de pontos por focos" value={config.cap_focos ?? 40} min={20} max={60} onChange={(v) => set('cap_focos', v)} />
          </CardContent>
        </Card>

        {/* Epidemiologia */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Epidemiologia e clima</CardTitle>
            <CardDescription className="text-xs">Fatores ambientais e de saúde pública</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField label="Caso notificado em 300m" value={config.peso_caso_300m ?? 25} min={0} max={50} onChange={(v) => set('peso_caso_300m', v)} />
            <SliderField label="Chuva alta (>60mm/7d)" value={config.peso_chuva_alta ?? 10} min={0} max={20} onChange={(v) => set('peso_chuva_alta', v)} />
            <SliderField label="Temperatura >30°C" value={config.peso_temperatura_30 ?? 8} min={0} max={20} onChange={(v) => set('peso_temperatura_30', v)} />
            <SliderField label="Denúncia de cidadão ativa" value={config.peso_denuncia_cidadao ?? 10} min={0} max={25} onChange={(v) => set('peso_denuncia_cidadao', v)} />
            <Separator className="bg-border/60" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cap epidemiológico</p>
            <SliderField label="Máximo de pontos epidemiol." value={config.cap_epidemio ?? 30} min={15} max={50} onChange={(v) => set('cap_epidemio', v)} />
          </CardContent>
        </Card>

        {/* Histórico e operação */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Histórico e operação</CardTitle>
            <CardDescription className="text-xs">Fatores operacionais e de perfil do imóvel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField label="3+ focos no histórico" value={config.peso_historico_3focos ?? 15} min={0} max={30} onChange={(v) => set('peso_historico_3focos', v)} />
            <SliderField label="Histórico de recusa" value={config.peso_imovel_recusa ?? 8} min={0} max={20} onChange={(v) => set('peso_imovel_recusa', v)} />
            <SliderField label="SLA vencido" value={config.peso_sla_vencido ?? 12} min={0} max={25} onChange={(v) => set('peso_sla_vencido', v)} />
            <Separator className="bg-border/60" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Janelas temporais (dias)</p>
            <SliderField label="Janela de foco resolvido" description="Tempo que resolução reduz o score" value={config.janela_resolucao_dias ?? 30} min={7} max={90} onChange={(v) => set('janela_resolucao_dias', v)} />
            <SliderField label="Janela de vistoria negativa" value={config.janela_vistoria_dias ?? 45} min={7} max={90} onChange={(v) => set('janela_vistoria_dias', v)} />
          </CardContent>
        </Card>

        {/* Subtrações */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Subtrações de score</CardTitle>
            <CardDescription className="text-xs">Fatores que reduzem o risco do imóvel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField
              label="Foco resolvido recentemente"
              description="Valor negativo — reduz o score"
              value={config.peso_foco_resolvido ?? -15}
              min={-40} max={0}
              onChange={(v) => set('peso_foco_resolvido', v)}
              positive={false}
            />
            <SliderField
              label="Vistoria recente sem foco"
              description="Vistoria com acesso e sem focos encontrados"
              value={config.peso_vistoria_negativa ?? -8}
              min={-25} max={0}
              onChange={(v) => set('peso_vistoria_negativa', v)}
              positive={false}
            />
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          As alterações são aplicadas no próximo recálculo automático (diário às 04h BRT ou na próxima ação de campo).
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrões
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {isPending ? 'Salvando...' : 'Salvar configuração'}
          </Button>
        </div>
      </div>
    </div>
  );
}
