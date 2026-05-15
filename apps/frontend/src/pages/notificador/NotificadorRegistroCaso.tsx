import { useState } from 'react';
import { http } from '@sentinella/api-client';
import { ArrowLeft, Save, Loader2, MapPin, Calendar as CalendarIcon, AlertCircle, CheckCircle2, GitMerge, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useUnidadesSaude } from '@/hooks/queries/useUnidadesSaude';
import { useCasosNotificadosMutation, useCruzamentosDoCaso } from '@/hooks/queries/useCasosNotificados';
import { useRegioes } from '@/hooks/queries/useRegioes';
import { useNavigate } from 'react-router-dom';

const today = () => new Date().toISOString().split('T')[0];

interface FormState {
  doenca: string;
  unidade_saude_id: string;
  bairro_id: string;
  data_notificacao: string;
  data_inicio_sintomas: string;
  logradouro_bairro: string;
  bairro: string;
  latitude: string;
  longitude: string;
  observacao: string;
}

const INITIAL_FORM: FormState = {
  doenca: 'suspeito',
  unidade_saude_id: '',
  bairro_id: '',
  data_notificacao: today(),
  data_inicio_sintomas: '',
  logradouro_bairro: '',
  bairro: '',
  latitude: '',
  longitude: '',
  observacao: '',
};

export default function NotificadorRegistroCaso() {
  const navigate = useNavigate();
  const { clienteId, tenantStatus, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const { data: unidades = [], isLoading: loadingUnidades } = useUnidadesSaude(clienteId);
  const { data: regioes = [] } = useRegioes(clienteId);
  const casosNotificadosMutation = useCasosNotificadosMutation();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [geocoding, setGeocoding] = useState(false);
  const [geoWarning, setGeoWarning] = useState<string | null>(null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedCasoId, setSavedCasoId] = useState<string | null>(null);
  const [territorioDetectado, setTerritorioDetectado] = useState<{
    bairro: string | null;
    quadra: string | null;
    agente: string | null;
  } | null>(null);
  const { data: cruzamentos = [] } = useCruzamentosDoCaso(savedCasoId);

  const set = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleInputChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(field)(e.target.value);

  const handleGeocodificar = async () => {
    if (!form.logradouro_bairro.trim()) return;

    setGeocoding(true);
    setGeoWarning(null);

    try {
      const params = new URLSearchParams({ logradouro: form.logradouro_bairro });
      if (clienteAtivo?.cidade) params.set('cidade', clienteAtivo.cidade);
      if (clienteAtivo?.uf) params.set('uf', clienteAtivo.uf);

      const result = await http.get<{ lat: number | null; lng: number | null }>(
        `/notificacoes/geocode?${params.toString()}`,
      );

      if (result?.lat != null) {
        setForm((prev) => ({
          ...prev,
          latitude: String(result.lat),
          longitude: String(result.lng),
        }));
        setGeoWarning(null);
      } else {
        setGeoWarning('Endereço não encontrado — verifique o logradouro e tente incluir o número');
      }
    } catch (err) {
      console.error('[Geocoding] erro:', err);
      setGeoWarning('Falha na geocodificação — insira as coordenadas manualmente abaixo');
      setShowManualCoords(true);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteId) { toast.error('Cliente não identificado'); return; }
    if (!form.unidade_saude_id) { toast.error('Selecione a unidade de saúde'); return; }
    if (!form.data_notificacao) { toast.error('Informe a data de notificação'); return; }

    try {
      const novoCaso = await casosNotificadosMutation.mutateAsync({
        cliente_id: clienteId!,
        doenca: form.doenca,
        status: 'suspeito',
        unidade_saude_id: form.unidade_saude_id,
        bairro_id: form.bairro_id || undefined,
        data_notificacao: form.data_notificacao,
        data_inicio_sintomas: form.data_inicio_sintomas || undefined,
        logradouro_bairro: form.logradouro_bairro || undefined,
        bairro: form.bairro || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        observacao: form.observacao || undefined,
      });

      setSavedCasoId(novoCaso.id);
      const terr = (novoCaso as Record<string, any>).territorio ?? {};
      const ag = (novoCaso as Record<string, any>).agente ?? {};
      setTerritorioDetectado({
        bairro: terr.bairro_nome ?? null,
        quadra: terr.quadra_codigo ?? null,
        agente: ag.nome ?? null,
      });
      setSuccess(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar caso');
    }
  };

  const handleNovoCaso = () => {
    setForm({ ...INITIAL_FORM, data_notificacao: today() });
    setGeoWarning(null);
    setSuccess(false);
    setSavedCasoId(null);
    setTerritorioDetectado(null);
  };

  const isSubmitting = casosNotificadosMutation.isPending;

  // ── Tela de sucesso ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
        <div className="rounded-full bg-emerald-100 dark:bg-emerald-950 p-6">
          <CheckCircle2 className="w-14 h-14 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Caso registrado!</h1>
          <p className="text-muted-foreground text-sm">
            Dados salvos com sucesso e repassados à equipe de vigilância.
          </p>
        </div>

        {savedCasoId && (
          <div className="w-full max-w-xs rounded-xl border border-border bg-muted/40 px-4 py-3 text-center space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Protocolo</p>
            <p className="text-2xl font-extrabold text-primary tracking-widest">{savedCasoId.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-muted-foreground">Guarde este número para referência</p>
          </div>
        )}

        {/* Território resolvido pelo lat/long do endereço */}
        {territorioDetectado &&
          (territorioDetectado.bairro || territorioDetectado.quadra || territorioDetectado.agente) && (
            <div className="w-full max-w-xs rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-start gap-2.5 text-left">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-foreground space-y-0.5">
                {territorioDetectado.bairro && (
                  <p><span className="text-muted-foreground">Bairro:</span> <span className="font-semibold">{territorioDetectado.bairro}</span></p>
                )}
                {territorioDetectado.quadra && (
                  <p><span className="text-muted-foreground">Quadra:</span> <span className="font-semibold">{territorioDetectado.quadra}</span></p>
                )}
                <p>
                  <span className="text-muted-foreground">Agente:</span>{' '}
                  <span className="font-semibold">
                    {territorioDetectado.agente ?? 'a definir pela supervisão'}
                  </span>
                </p>
              </div>
            </div>
          )}

        {/* Focos próximos encontrados pelo trigger */}
        {cruzamentos.length > 0 ? (
          <div className="w-full max-w-xs rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800/40 px-4 py-3 flex items-start gap-2.5 text-left">
            <GitMerge className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300 font-medium leading-snug">
              <span className="font-bold">{cruzamentos.length}</span>{' '}
              {cruzamentos.length === 1 ? 'foco próximo encontrado' : 'focos próximos encontrados'} neste endereço.
              {' '}Prioridade elevada para Crítico automaticamente.
            </p>
          </div>
        ) : savedCasoId ? (
          <div className="w-full max-w-xs rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800/40 px-4 py-3 flex items-center gap-2.5 text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
              Nenhum foco ativo próximo a este endereço.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button className="w-full rounded-xl h-11 font-bold" onClick={handleNovoCaso}>
            Registrar outro caso
          </Button>
          <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // ── Formulário mobile-first ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header sticky */}
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold text-base leading-tight">Registrar Caso</h1>
          <p className="text-xs text-muted-foreground">Suspeito ou confirmado de arbovirose</p>
        </div>
      </div>

      {/* Aviso LGPD */}
      <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          <strong>LGPD:</strong> Não inserir nome, CPF ou dados pessoais identificáveis do paciente.
        </p>
      </div>

      {/* Corpo scrollável — pb extra no mobile: barra fixa acima do bottom nav (h-16) */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 pb-40 lg:pb-28 space-y-5">

        {/* Doença */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Doença</Label>
          <Select value={form.doenca} onValueChange={set('doenca')}>
            <SelectTrigger className="h-12 text-base rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suspeito">Suspeito (a confirmar)</SelectItem>
              <SelectItem value="dengue">Dengue</SelectItem>
              <SelectItem value="chikungunya">Chikungunya</SelectItem>
              <SelectItem value="zika">Zika</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unidade de saúde */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Unidade de saúde <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.unidade_saude_id}
            onValueChange={set('unidade_saude_id')}
            disabled={loadingUnidades}
          >
            <SelectTrigger className="h-12 text-base rounded-xl">
              <SelectValue placeholder={loadingUnidades ? 'Carregando...' : 'Selecione a unidade'} />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Região / Bairro */}
        {regioes.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Bairro / Região</Label>
            <Select
              value={form.bairro_id || '_nenhuma'}
              onValueChange={(v) => {
                if (v === '_nenhuma') {
                  setForm((prev) => ({ ...prev, bairro_id: '', bairro: '' }));
                } else {
                  const regiao = regioes.find((r) => r.id === v);
                  setForm((prev) => ({
                    ...prev,
                    bairro_id: v,
                    bairro: regiao?.bairro ?? regiao?.nome ?? prev.bairro,
                  }));
                }
              }}
            >
              <SelectTrigger className="h-12 text-base rounded-xl">
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_nenhuma">Não informado</SelectItem>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.regiao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              Data do registro <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-start rounded-xl text-left font-normal text-base"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {form.data_notificacao
                    ? format(parseISO(form.data_notificacao), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.data_notificacao ? parseISO(form.data_notificacao) : undefined}
                  onSelect={(date) => set('data_notificacao')(date ? format(date, 'yyyy-MM-dd') : '')}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              Início dos sintomas
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-start rounded-xl text-left font-normal text-base"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {form.data_inicio_sintomas
                    ? format(parseISO(form.data_inicio_sintomas), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.data_inicio_sintomas ? parseISO(form.data_inicio_sintomas) : undefined}
                  onSelect={(date) => set('data_inicio_sintomas')(date ? format(date, 'yyyy-MM-dd') : '')}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Endereço (sem identificação pessoal)</Label>
          <Input
            placeholder="Ex: Rua das Flores, 100"
            value={form.logradouro_bairro}
            onChange={handleInputChange('logradouro_bairro')}
            className="h-12 rounded-xl text-base"
          />
        </div>

        {/* Geocodificação */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl flex-1 gap-2"
              onClick={handleGeocodificar}
              disabled={geocoding || !form.logradouro_bairro.trim()}
            >
              {geocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {geocoding ? 'Geocodificando...' : 'Geocodificar endereço'}
            </Button>
            {form.latitude && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                OK
              </span>
            )}
          </div>

          {geoWarning && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {geoWarning}
            </p>
          )}

          {form.latitude && !showManualCoords && (
            <p className="text-xs text-muted-foreground font-mono">
              {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
            </p>
          )}

          {!showManualCoords && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline flex items-center gap-1"
              onClick={() => setShowManualCoords(true)}
            >
              <Pencil className="h-3 w-3" />
              Inserir coordenadas manualmente
            </button>
          )}

          {showManualCoords && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">
                Coordenadas manuais (opcional — melhora o cruzamento geoespacial)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    placeholder="-23.5505"
                    value={form.latitude}
                    onChange={handleInputChange('latitude')}
                    className="h-10 rounded-xl text-sm font-mono"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    placeholder="-46.6333"
                    value={form.longitude}
                    onChange={handleInputChange('longitude')}
                    className="h-10 rounded-xl text-sm font-mono"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ex: Latitude -23.5505 / Longitude -46.6333 — formato decimal, negativo no Brasil
              </p>
            </div>
          )}
        </div>

        {/* Observação */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Observação</Label>
          <Textarea
            placeholder="Informações adicionais sobre o caso..."
            value={form.observacao}
            onChange={handleInputChange('observacao')}
            rows={3}
            className="rounded-xl text-base resize-none"
          />
        </div>
      </form>

      {/* Botão fixo acima da navegação móvel (AppLayout: bottom nav h-16 + z-50); no lg não há bottom nav */}
      <div className="fixed bottom-16 inset-x-0 z-40 bg-card border-t px-4 pt-3 pb-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-black/25 lg:bottom-0 lg:z-30 lg:shadow-none lg:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Button
          type="submit"
          className="w-full h-12 rounded-xl text-base font-bold gap-2"
          disabled={isSubmitting || !!tenantStatus?.isBlocked}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {isSubmitting ? 'Registrando...' : 'Registrar caso'}
        </Button>
      </div>
    </div>
  );
}
