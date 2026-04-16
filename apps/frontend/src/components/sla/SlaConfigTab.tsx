import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw, Clock, Thermometer, CloudRain, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SlaConfigJson,
  SlaConfigRow,
  SlaPrioridadeConfig,
  DEFAULT_SLA_CONFIG,
} from '@/types/sla-config';

interface Props {
  clienteId: string | null;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const CRITICIDADE_OPTIONS = ['Muito Alta', 'Alta', 'Média', 'Baixa'];

export default function SlaConfigTab({ clienteId }: Props) {
  const [config, setConfig] = useState<SlaConfigJson>(structuredClone(DEFAULT_SLA_CONFIG));
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPrioridade, setNewPrioridade] = useState('');

  const fetchConfig = useCallback(async () => {
    if (!clienteId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.slaConfig.getByCliente(clienteId);

      if (data) {
        const row = data as SlaConfigRow;
        setExistingId(row.id);
        setConfig(row.config);
      } else {
        setExistingId(null);
        setConfig(structuredClone(DEFAULT_SLA_CONFIG));
      }
    } catch {
      // Table might not exist yet — use defaults
      setExistingId(null);
      setConfig(structuredClone(DEFAULT_SLA_CONFIG));
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /* ── Handlers ── */
  const updatePrioridade = (key: string, field: keyof SlaPrioridadeConfig, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      prioridades: {
        ...prev.prioridades,
        [key]: { ...prev.prioridades[key], [field]: value },
      },
    }));
  };

  const removePrioridade = (key: string) => {
    setConfig(prev => {
      const copy = { ...prev.prioridades };
      delete copy[key];
      return { ...prev, prioridades: copy };
    });
  };

  const addPrioridade = () => {
    const name = newPrioridade.trim();
    if (!name) return;
    if (config.prioridades[name]) {
      toast.error('Prioridade já existe');
      return;
    }
    setConfig(prev => ({
      ...prev,
      prioridades: { ...prev.prioridades, [name]: { horas: 24, criticidade: 'Média' } },
    }));
    setNewPrioridade('');
  };

  const updateFator = (field: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      fatores: { ...prev.fatores, [field]: value },
    }));
  };

  const updateHorario = (field: string, value: unknown) => {
    setConfig(prev => ({
      ...prev,
      horario_comercial: { ...prev.horario_comercial, [field]: value },
    }));
  };

  const toggleDia = (dia: number) => {
    setConfig(prev => {
      const dias = prev.horario_comercial.dias_semana.includes(dia)
        ? prev.horario_comercial.dias_semana.filter(d => d !== dia)
        : [...prev.horario_comercial.dias_semana, dia].sort();
      return { ...prev, horario_comercial: { ...prev.horario_comercial, dias_semana: dias } };
    });
  };

  const handleSave = async () => {
    if (!clienteId) return;
    setSaving(true);
    try {
      await api.slaConfig.upsert(clienteId, config as unknown as Record<string, unknown>, existingId);
      toast.success('Configuração de SLA salva com sucesso');
      await fetchConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(structuredClone(DEFAULT_SLA_CONFIG));
    toast.info('Restaurado para valores padrão (salve para aplicar)');
  };

  if (!clienteId) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Selecione um cliente para configurar o SLA.
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
    <div className="space-y-5 animate-fade-in">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold">Regras de SLA do Cliente</h3>
          <p className="text-xs text-muted-foreground">
            {existingId ? 'Configuração personalizada ativa' : 'Usando configuração padrão'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ── 1. Horas por Prioridade ── */}
      <Card className="card-premium">
        <CardHeader className="p-4 pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Horas por Prioridade
          </CardTitle>
          <CardDescription className="text-xs">
            Defina o prazo máximo (em horas) para cada nível de prioridade.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {Object.entries(config.prioridades).map(([key, val]) => (
            <div key={key} className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="min-w-[110px] justify-center text-xs font-bold">
                {key}
              </Badge>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground w-14 shrink-0">Horas:</Label>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={val.horas}
                  onChange={e => updatePrioridade(key, 'horas', Math.max(1, Number(e.target.value)))}
                  className="w-20 h-8 text-xs"
                />
                <Label className="text-xs text-muted-foreground w-20 shrink-0">Criticidade:</Label>
                <select
                  value={val.criticidade}
                  onChange={e => updatePrioridade(key, 'criticidade', e.target.value)}
                  className="h-8 text-xs rounded-md border border-input bg-background px-2"
                >
                  {CRITICIDADE_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {/* Only allow removing non-default priorities */}
              {!DEFAULT_SLA_CONFIG.prioridades[key] && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePrioridade(key)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}

          <Separator className="my-2" />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nova prioridade..."
              value={newPrioridade}
              onChange={e => setNewPrioridade(e.target.value)}
              className="h-8 text-xs max-w-[200px]"
              onKeyDown={e => e.key === 'Enter' && addPrioridade()}
            />
            <Button variant="outline" size="sm" onClick={addPrioridade} className="gap-1 text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Fatores de Redução ── */}
      <Card className="card-premium">
        <CardHeader className="p-4 pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-primary" />
            Fatores de Redução
          </CardTitle>
          <CardDescription className="text-xs">
            Percentuais de redução no prazo SLA conforme condições ambientais.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Risco Muito Alto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                🔴 Risco &quot;Muito Alto&quot;
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Reduz o prazo quando a classificação de risco é &quot;Muito Alto&quot;.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Redução:</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={config.fatores.risco_muito_alto_pct}
                onChange={e => updateFator('risco_muito_alto_pct', Math.max(0, Math.min(90, Number(e.target.value))))}
                className="w-20 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          {/* Persistência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                🌧️ Persistência de Chuva
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Reduz o prazo se chuva persistir por mais de N dias.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground shrink-0">Dias &gt;</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={config.fatores.persistencia_dias_min}
                onChange={e => updateFator('persistencia_dias_min', Math.max(1, Number(e.target.value)))}
                className="w-16 h-8 text-xs"
              />
              <Label className="text-xs text-muted-foreground shrink-0">Redução:</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={config.fatores.persistencia_pct}
                onChange={e => updateFator('persistencia_pct', Math.max(0, Math.min(90, Number(e.target.value))))}
                className="w-20 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          {/* Temperatura */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5" /> Temperatura Elevada
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Reduz o prazo quando a temperatura média excede o limiar.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground shrink-0">Temp &gt;</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={config.fatores.temperatura_min}
                onChange={e => updateFator('temperatura_min', Math.max(0, Number(e.target.value)))}
                className="w-16 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">°C</span>
              <Label className="text-xs text-muted-foreground shrink-0">Redução:</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={config.fatores.temperatura_pct}
                onChange={e => updateFator('temperatura_pct', Math.max(0, Math.min(90, Number(e.target.value))))}
                className="w-20 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Horário Comercial ── */}
      <Card className="card-premium">
        <CardHeader className="p-4 pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Horário Comercial
          </CardTitle>
          <CardDescription className="text-xs">
            Pausar a contagem do SLA fora do expediente do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-semibold">Ativar Horário Comercial</Label>
              <p className="text-[10px] text-muted-foreground">
                SLA só conta durante o expediente definido.
              </p>
            </div>
            <Switch
              checked={config.horario_comercial.ativo}
              onCheckedChange={v => updateHorario('ativo', v)}
            />
          </div>

          {config.horario_comercial.ativo && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Início do Expediente</Label>
                  <Input
                    type="time"
                    value={config.horario_comercial.inicio}
                    onChange={e => updateHorario('inicio', e.target.value)}
                    className="h-8 text-xs w-32"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fim do Expediente</Label>
                  <Input
                    type="time"
                    value={config.horario_comercial.fim}
                    onChange={e => updateHorario('fim', e.target.value)}
                    className="h-8 text-xs w-32"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dias da Semana</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDia(d.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                        config.horario_comercial.dias_semana.includes(d.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
