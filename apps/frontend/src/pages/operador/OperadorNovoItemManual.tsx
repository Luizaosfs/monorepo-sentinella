import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePlanejamentosAtivosManuais } from '@/hooks/queries/usePlanejamentosAtivosManuais';
import { usePlanoAcaoCatalogo } from '@/hooks/queries/usePlanoAcaoCatalogo';
import { useYoloClassConfig } from '@/hooks/queries/useYoloClassConfig';
import { useDroneRiskConfig, derivarClassificacao } from '@/hooks/queries/useDroneRiskConfig';
import { api } from '@/services/api';
import { getCurrentLocationAndAddress, reverseGeocode } from '@/lib/geo';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from 'sonner';
import { handleQuotaError } from '@/lib/quotaErrorHandler';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { Loader2, ArrowLeft, CalendarIcon, PlusCircle, MapPin, Camera, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_SLA_HORAS = 24;

const PRIORIDADE_OPTIONS = [
  { value: 'Crítica',       label: 'Crítica',       sla: 4  },
  { value: 'Urgente',       label: 'Urgente',       sla: 4  },
  { value: 'Alta',          label: 'Alta',          sla: 12 },
  { value: 'Moderada',      label: 'Moderada',      sla: 24 },
  { value: 'Média',         label: 'Média',         sla: 24 },
  { value: 'Baixa',         label: 'Baixa',         sla: 72 },
  { value: 'Monitoramento', label: 'Monitoramento', sla: 72 },
] as const;

const SCORE_OPTIONS = [
  { value: '90', label: 'P1 – Crítico  (80–100)' },
  { value: '70', label: 'P2 – Alto     (60–79)'  },
  { value: '50', label: 'P3 – Médio    (40–59)'  },
  { value: '30', label: 'P4 – Baixo    (20–39)'  },
  { value: '10', label: 'P5 – Mínimo   (0–19)'   },
];

const emptyForm = {
  planejamento_id: '',
  data_voo: new Date(),
  latitude: '' as string | number,
  longitude: '' as string | number,
  item: '',          // auto-preenchido pelo yolo.item ao selecionar tipo
  selectedItemKey: '', // item_key do sentinela_yolo_class_config
  risco: '',
  acao: '',
  score_final: '' as string | number,
  prioridade: '',
  sla_horas: DEFAULT_SLA_HORAS as string | number,
  endereco_curto: '',
  endereco_completo: '',
  image_url: '',
};

const OperadorNovoItemManual = () => {
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const { data: planejamentos = [], isLoading: loadingPlan } = usePlanejamentosAtivosManuais(clienteId);
  const { data: yoloClasses = [], isLoading: loadingTipos } = useYoloClassConfig(clienteId);
  const { data: droneConfig } = useDroneRiskConfig(clienteId);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const { state: geoState, request: requestGeo } = useGeolocation();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadPublicId, setUploadPublicId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittedSuccessRef = useRef(false);

  const selectedItemKey = form.selectedItemKey || undefined;
  const { data: acaoCatalogo = [], isLoading: loadingAcao } = usePlanoAcaoCatalogo(clienteId, selectedItemKey);

  // Ao sair sem concluir, exclui imagem do Cloudinary
  useEffect(() => {
    return () => {
      if (uploadPublicId && uploadPublicId.trim() && !submittedSuccessRef.current) {
        api.cloudinary.deleteImage(uploadPublicId).catch(() => {});
      }
    };
  }, [uploadPublicId]);

  const preencherEndereco = useCallback(async (lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    try {
      const { endereco_curto, endereco_completo } = await reverseGeocode(lat, lng);
      setForm((prev) => ({
        ...prev,
        endereco_curto: endereco_curto || prev.endereco_curto,
        endereco_completo: endereco_completo || prev.endereco_completo,
      }));
    } catch {
      // coords preenchidas; endereço pode ser digitado manualmente
    }
  }, []);

  // Geolocalização automática na abertura
  useEffect(() => { requestGeo(); }, [requestGeo]);

  useEffect(() => {
    if (geoState.status === 'success' && form.latitude === '' && form.longitude === '') {
      preencherEndereco(geoState.latitude, geoState.longitude);
    }
  }, [geoState, form.latitude, form.longitude, preencherEndereco]);

  /** Ao trocar tipo de item: auto-preenche item, ação, risco, score, prioridade e sla. */
  const handleTipoChange = useCallback((itemKey: string) => {
    if (itemKey === '__none__') {
      setForm((prev) => ({
        ...prev,
        selectedItemKey: '',
        item: '',
        acao: '',
        risco: '',
        score_final: '',
        prioridade: '',
        sla_horas: DEFAULT_SLA_HORAS,
      }));
      return;
    }
    const yolo = yoloClasses.find((c) => c.item_key === itemKey);
    const classificacao = yolo && droneConfig
      ? derivarClassificacao(yolo.risco, droneConfig)
      : null;
    setForm((prev) => ({
      ...prev,
      selectedItemKey: itemKey,
      item: yolo?.item ?? '',
      acao: yolo?.acao ?? '',
      risco: yolo?.risco ?? '',
      score_final: classificacao ? classificacao.score_final : '',
      prioridade: classificacao ? classificacao.prioridade : '',
      sla_horas: classificacao ? classificacao.sla_horas : DEFAULT_SLA_HORAS,
    }));
  }, [yoloClasses, droneConfig]);

  /** Ao trocar prioridade: auto-preenche sla_horas. */
  const handlePrioridadeChange = useCallback((value: string) => {
    const opt = PRIORIDADE_OPTIONS.find((p) => p.value === value);
    setForm((prev) => ({
      ...prev,
      prioridade: value === '__none__' ? '' : value,
      sla_horas: opt ? opt.sla : prev.sla_horas,
    }));
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem (JPG, PNG, etc.).');
      return;
    }
    if (!isCloudinaryConfigured()) {
      toast.error('Upload de imagem não configurado. Configure Cloudinary no .env.');
      return;
    }
    setUploadingImage(true);
    setUploadPublicId(null);
    try {
      const { secure_url, public_id } = await uploadImage(file);
      setForm((prev) => ({ ...prev, image_url: secure_url }));
      setUploadPublicId(public_id?.trim() ? public_id : null);
      toast.success('Imagem enviada.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar imagem.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoverImagem = async () => {
    if (uploadPublicId?.trim()) {
      try { await api.cloudinary.deleteImage(uploadPublicId); } catch { /* ignora */ }
      setUploadPublicId(null);
    }
    setForm((prev) => ({ ...prev, image_url: '' }));
    toast.success('Imagem removida.');
  };

  const handleUsarMinhaLocalizacao = async () => {
    setLoadingGeo(true);
    try {
      const { lat, lng, endereco_curto, endereco_completo } = await getCurrentLocationAndAddress();
      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        endereco_curto: endereco_curto || prev.endereco_curto,
        endereco_completo: endereco_completo || prev.endereco_completo,
      }));
      toast.success('Localização e endereço preenchidos.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível obter a localização.');
    } finally {
      setLoadingGeo(false);
    }
  };

  const handleBuscarEnderecoPorCoordenadas = async () => {
    const lat = form.latitude === '' ? NaN : Number(form.latitude);
    const lng = form.longitude === '' ? NaN : Number(form.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error('Informe latitude e longitude primeiro.');
      return;
    }
    setLoadingGeo(true);
    try {
      const { endereco_curto, endereco_completo } = await reverseGeocode(lat, lng);
      setForm((prev) => ({
        ...prev,
        endereco_curto: endereco_curto || prev.endereco_curto,
        endereco_completo: endereco_completo || prev.endereco_completo,
      }));
      toast.success('Endereço preenchido.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível buscar o endereço.');
    } finally {
      setLoadingGeo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.planejamento_id.trim()) {
      toast.error('Selecione o planejamento.');
      return;
    }
    if (clienteId) {
      try {
        const q = await api.quotas.verificar(clienteId, 'itens_mes');
        if (!q.ok) {
          toast.error(`Quota de itens atingida: ${q.usado}/${q.limite} itens este mês.`);
          return;
        }
        if (q.limite != null && q.usado >= q.limite * 0.8) {
          toast.warning(`Atenção: ${q.usado}/${q.limite} itens utilizados este mês.`);
        }
      } catch { /* quota indisponível — continua */ }
    }
    setSaving(true);
    try {
      const result = await api.itens.criarManual({
        planejamento_id: form.planejamento_id,
        data_voo: format(form.data_voo, 'yyyy-MM-dd'),
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        item: form.item.trim() || null,
        risco: form.risco.trim() || null,
        acao: form.acao.trim() || null,
        score_final: form.score_final === '' ? null : Number(form.score_final),
        prioridade: form.prioridade.trim() || null,
        sla_horas: form.sla_horas === '' ? DEFAULT_SLA_HORAS : Number(form.sla_horas),
        endereco_curto: form.endereco_curto.trim() || null,
        endereco_completo: form.endereco_completo.trim() || null,
        image_url: form.image_url.trim() || null,
        image_public_id: uploadPublicId || null,
        tags: null,
      });
      submittedSuccessRef.current = true;
      toast.success(
        result.levantamento_criado
          ? 'Item criado. Novo levantamento criado.'
          : 'Item criado. Levantamento reutilizado.'
      );
      navigate('/agente/levantamentos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar item');
    } finally {
      setSaving(false);
    }
  };

  if (!clienteId) {
    return (
      <div className="p-3 sm:p-4">
        <Card className="rounded-2xl border-border/60">
          <CardContent className="py-12 text-center">
            <p className="font-semibold text-foreground">Cliente não selecionado.</p>
            <p className="text-sm text-muted-foreground mt-2">Selecione um cliente no menu.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/agente/levantamentos')}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 pb-24 w-full max-w-none mx-auto animate-fade-in sm:px-3">
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl w-11 h-11" onClick={() => navigate('/agente/levantamentos')} aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-primary sm:text-xl">Criar item manual</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do item de levantamento.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Card: Obrigatórios */}
        <Card className="rounded-2xl border-2 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="px-3 pt-2.5 pb-1.5 sm:px-5 sm:pt-3 sm:pb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Obrigatórios</p>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3 pt-0 pb-3 sm:px-5 sm:pb-3">

            {/* Planejamento */}
            <div className="space-y-1">
              <Label className="text-sm">Planejamento *</Label>
              <Select
                value={form.planejamento_id}
                onValueChange={(v) => setForm((prev) => ({ ...prev, planejamento_id: v }))}
                disabled={loadingPlan || planejamentos.length === 0}
              >
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue
                    placeholder={
                      loadingPlan
                        ? 'Carregando...'
                        : planejamentos.length === 0
                          ? 'Nenhum planejamento cadastrado'
                          : 'Selecione o planejamento'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {planejamentos.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.descricao || `Planejamento ${p.id.slice(0, 8)}`}
                      {typeof p.ativo === 'boolean' && (
                        <span className="text-muted-foreground/70">
                          {' '}({p.ativo ? 'Ativo' : 'Inativo'})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingPlan && planejamentos.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Cadastre um planejamento ativo com tipo MANUAL para este cliente para poder criar itens manuais.
                </p>
              )}
            </div>

            {/* Data */}
            <div className="space-y-1">
              <Label className="text-sm">Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal rounded-xl h-11',
                      !form.data_voo && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {form.data_voo ? format(form.data_voo, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.data_voo}
                    onSelect={(d) => d && setForm((prev) => ({ ...prev, data_voo: d }))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tipo de item — fonte: sentinela_yolo_class_config (por cliente) */}
            <div className="space-y-1">
              <Label className="text-sm">Tipo de item</Label>
              {loadingTipos ? (
                <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-input text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando tipos...
                </div>
              ) : (
                <Select
                  value={form.selectedItemKey || '__none__'}
                  onValueChange={handleTipoChange}
                >
                  <SelectTrigger className="rounded-xl h-11 w-full">
                    <SelectValue placeholder="Selecione o tipo de item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-muted-foreground">
                      Nenhum
                    </SelectItem>
                    {yoloClasses.map((c) => (
                      <SelectItem key={c.id} value={c.item_key} className="text-sm">
                        {c.item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!loadingTipos && yoloClasses.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Nenhum tipo cadastrado para este cliente.
                </p>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Card: Localização */}
        <Card className="rounded-2xl border-2 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="px-3 pt-2.5 pb-1.5 sm:px-5 sm:pt-3 sm:pb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Localização</p>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3 pt-0 pb-3 sm:px-5 sm:pb-3">
            {geoState.status === 'loading' && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Obtendo sua localização automaticamente...
              </div>
            )}
            {geoState.status === 'denied' && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Permissão de localização negada. Use o botão abaixo ou preencha manualmente.
              </p>
            )}
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto rounded-xl gap-1.5 h-11"
                onClick={handleUsarMinhaLocalizacao}
                disabled={loadingGeo || geoState.status === 'loading'}
              >
                {loadingGeo ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
                {form.latitude !== '' ? 'Atualizar localização' : 'Usar minha localização'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Preenche latitude, longitude e endereço a partir do local atual.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-sm">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="-15.78"
                  className="rounded-xl h-11"
                  value={form.latitude}
                  onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="-47.93"
                  className="rounded-xl h-11"
                  value={form.longitude}
                  onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                />
              </div>
            </div>
            {form.latitude !== '' && form.longitude !== '' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground rounded-xl gap-1.5 h-10 w-full sm:w-auto"
                onClick={handleBuscarEnderecoPorCoordenadas}
                disabled={loadingGeo}
              >
                {loadingGeo ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
                Buscar endereço pelas coordenadas
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Card: Classificação */}
        <Card className="rounded-2xl border-2 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="px-3 pt-2.5 pb-1.5 sm:px-5 sm:pt-3 sm:pb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Classificação</p>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3 pt-0 pb-3 sm:px-5 sm:pb-3">

            {/* Ação — select do catálogo filtrado pelo tipo selecionado */}
            <div className="space-y-1">
              <Label className="text-sm">Ação</Label>
              {loadingAcao ? (
                <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-input text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando ações...
                </div>
              ) : acaoCatalogo.length > 0 ? (
                <Select
                  value={form.acao || '__none__'}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, acao: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione a ação corretiva" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-muted-foreground">—</SelectItem>
                    {acaoCatalogo.map((a) => (
                      <SelectItem key={a.id} value={a.label} className="text-sm">
                        {a.label}
                        {a.descricao && (
                          <span className="ml-1 text-muted-foreground text-xs">– {a.descricao}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Ex.: Limpeza, Remoção"
                  className="rounded-xl h-11"
                  value={form.acao}
                  onChange={(e) => setForm((prev) => ({ ...prev, acao: e.target.value }))}
                />
              )}
              {!loadingAcao && acaoCatalogo.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma ação cadastrada para este cliente. Digite livremente.
                </p>
              )}
            </div>

            {/* Risco + Prioridade */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-sm">Risco</Label>
                <Select
                  value={form.risco || '__none__'}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, risco: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Risco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Prioridade</Label>
                <Select
                  value={form.prioridade || '__none__'}
                  onValueChange={handlePrioridadeChange}
                >
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {PRIORIDADE_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-sm">
                        {p.label}
                        <span className="ml-1 text-muted-foreground text-xs">({p.sla}h)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Score final + SLA */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-sm">Score final</Label>
                <Select
                  value={form.score_final === '' ? '__none__' : String(form.score_final)}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, score_final: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Score" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {SCORE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-sm font-mono">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">SLA (horas)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder={String(DEFAULT_SLA_HORAS)}
                  className="rounded-xl h-11"
                  value={form.sla_horas}
                  onChange={(e) => setForm((prev) => ({ ...prev, sla_horas: e.target.value }))}
                />
                {form.prioridade && (
                  <p className="text-xs text-muted-foreground">Auto preenchido pela prioridade.</p>
                )}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Card: Endereço */}
        <Card className="rounded-2xl border-2 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="px-3 pt-2.5 pb-1.5 sm:px-5 sm:pt-3 sm:pb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Endereço</p>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3 pt-0 pb-3 sm:px-5 sm:pb-3">
            <div className="space-y-1">
              <Label className="text-sm">Endereço curto</Label>
              <Input
                placeholder="Rua, número, bairro (ou use 'Usar minha localização')"
                className="rounded-xl h-11"
                value={form.endereco_curto}
                onChange={(e) => setForm((prev) => ({ ...prev, endereco_curto: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Endereço completo</Label>
              <Textarea
                placeholder="Endereço completo"
                rows={2}
                className="rounded-xl resize-none min-h-[80px]"
                value={form.endereco_completo}
                onChange={(e) => setForm((prev) => ({ ...prev, endereco_completo: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card: Imagem */}
        <Card className="rounded-2xl border-2 border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="px-3 pt-2.5 pb-1.5 sm:px-5 sm:pt-3 sm:pb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Imagem</p>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3 pt-0 pb-3 sm:px-5 sm:pb-3">
            {isCloudinaryConfigured() ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    {uploadingImage ? 'Enviando...' : 'Tirar foto / Enviar imagem'}
                  </Button>
                  {form.image_url && (
                    <>
                      <a
                        href={form.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline truncate max-w-[200px]"
                      >
                        Ver imagem
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive rounded-xl gap-1"
                        onClick={handleRemoverImagem}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  No celular abre a câmera; no computador selecione um arquivo.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env para enviar fotos.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-muted-foreground font-normal text-xs">URL da imagem (ou cole manualmente)</Label>
              <Input
                type="url"
                placeholder="https://... ou use o botão acima"
                className="rounded-xl h-11"
                value={form.image_url}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl flex-1 h-12 font-semibold"
            onClick={() => navigate('/agente/levantamentos')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="rounded-2xl flex-1 h-12 gap-1.5 font-semibold"
            disabled={saving || !form.planejamento_id}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            <PlusCircle className="w-4 h-4 shrink-0" />
            Criar item
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OperadorNovoItemManual;
