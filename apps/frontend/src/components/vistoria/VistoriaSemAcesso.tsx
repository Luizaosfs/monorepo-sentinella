import { useRef, useState } from 'react';
import { generateUUID } from '@/lib/uuid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Home, Plane, ShieldOff, Dog, Wrench, FileText, ChevronLeft, AlertTriangle, Camera, Loader2, Upload } from 'lucide-react';
import { invokeUploadEvidencia } from '@/lib/uploadEvidencia';
import {
  MotivoSemAcesso, HorarioSugerido,
  MOTIVO_LABELS, HORARIO_LABELS,
  PosicaoCalha, CondicaoCalha,
  POSICAO_CALHA_LABELS, CONDICAO_CALHA_LABELS,
  TipoAtividade,
} from '@/types/database';
import { api } from '@/services/api';
import { enqueue } from '@/lib/offlineQueue';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import type { Etapa1Data } from './VistoriaEtapa1Responsavel';

const MOTIVO_ICONS: Record<MotivoSemAcesso, React.ReactNode> = {
  fechado_ausente:   <Home className="w-5 h-5" />,
  fechado_viagem:    <Plane className="w-5 h-5" />,
  recusa_entrada:    <ShieldOff className="w-5 h-5" />,
  cachorro_bravo:    <Dog className="w-5 h-5" />,
  calha_inacessivel: <Wrench className="w-5 h-5" />,
  outro:             <FileText className="w-5 h-5" />,
};

const MOTIVOS: MotivoSemAcesso[] = [
  'fechado_ausente', 'fechado_viagem', 'recusa_entrada',
  'cachorro_bravo', 'calha_inacessivel', 'outro',
];

const HORARIOS: HorarioSugerido[] = ['manha', 'tarde', 'fim_de_semana', 'sem_previsao'];

const UPLOAD_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function filenameSemAcessoComExtensao(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  let ext = 'jpg';
  if (fromName && UPLOAD_EXTS.has(fromName)) {
    ext = fromName === 'jpeg' ? 'jpg' : fromName;
  } else if (file.type === 'image/png') ext = 'png';
  else if (file.type === 'image/webp') ext = 'webp';
  else if (file.type === 'image/gif') ext = 'gif';
  return `sem_acesso_${Date.now()}.${ext}`;
}

interface Props {
  clienteId: string;
  imovelId: string | undefined;
  agenteId: string;
  atividade: TipoAtividade;
  ciclo: number;
  etapa1: Etapa1Data;
  onRegistered: () => void;
  onCancel: () => void;
}

export function VistoriaSemAcesso({
  clienteId,
  imovelId,
  agenteId,
  atividade,
  ciclo,
  etapa1,
  onRegistered,
  onCancel,
}: Props) {
  const queryClient = useQueryClient();
  const { tenantStatus } = useClienteAtivo();

  const { data: vistorias = [] } = useQuery({
    queryKey: ['vistorias_imovel_sem_acesso', imovelId, clienteId],
    queryFn: () => api.vistorias.listByImovel(imovelId!, clienteId),
    enabled: !!imovelId,
    staleTime: 0,
  });

  const contadorTentativas = vistorias.filter((v) => !v.acesso_realizado).length;

  // Gerada uma vez por montagem — garante idempotência no RPC (evita 409 em retry/double-click)
  const [idempotencyKey] = useState(() => generateUUID());

  const [motivo, setMotivo] = useState<MotivoSemAcesso | null>(null);
  const [horario, setHorario] = useState<HorarioSugerido | null>(null);
  const [observacao, setObservacao] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [vistoriaCalha, setVistoriaCalha] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRecusa = motivo === 'recusa_entrada';

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
  }

  function clearFoto() {
    setFotoFile(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  const [calhaPos, setCalhaPos] = useState<PosicaoCalha>('frente');
  const [calhaCond, setCalhaCondicao] = useState<CondicaoCalha>('entupida');
  const [calhaFoco, setCalhaFoco] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!motivo) throw new Error('Selecione o motivo');

      // GPS obrigatório para recusa
      if (motivo === 'recusa_entrada' && !etapa1.lat_chegada) {
        throw new Error(
          'Localização GPS é necessária para registrar recusa. Aguarde a obtenção do GPS ou ative-o nas configurações.',
        );
      }

      // Upload da foto via Edge Function (F-05: sem credenciais hardcoded)
      let fotoUrlFinal: string | null = null;
      if (fotoFile) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(fotoFile);
          });
          const up = await invokeUploadEvidencia({
            file_base64: base64,
            filename: filenameSemAcessoComExtensao(fotoFile),
            folder: 'sem_acesso',
          });
          if ('url' in up) {
            fotoUrlFinal = up.url;
          } else {
            toast.warning(up.error.message);
          }
        } catch (uploadErr) {
          console.error('[VistoriaSemAcesso] falha no upload da foto:', uploadErr);
          toast.warning('Foto não enviada, mas a vistoria será salva normalmente.');
        }
      }

      // Persistência transacional via RPC (M-01/F-06)
      // Alerta de retorno criado automaticamente pelo trigger trg_criar_alerta_retorno (F-03)
      // recusa_entrada não gera alerta (F-08)
      await api.vistorias.createCompleta({
        cliente_id: clienteId,
        imovel_id: imovelId,
        agente_id: agenteId,
        ciclo,
        tipo_atividade: atividade,
        data_visita: new Date().toISOString(),
        status: 'revisita',
        idempotency_key: idempotencyKey,
        moradores_qtd: etapa1.moradores_qtd,
        gravidas: etapa1.gravidas,
        idosos: etapa1.idosos,
        criancas_7anos: etapa1.criancas_7anos,
        lat_chegada: etapa1.lat_chegada,
        lng_chegada: etapa1.lng_chegada,
        checkin_em: etapa1.checkin_em,
        acesso_realizado: false,
        motivo_sem_acesso: motivo,
        proximo_horario_sugerido: horario ?? undefined,
        observacao_acesso: observacao.trim() || undefined,
        foto_externa_url: fotoUrlFinal ?? undefined,
        calhas: vistoriaCalha ? [{
          posicao: calhaPos,
          condicao: calhaCond,
          com_foco: calhaFoco,
          observacao: undefined,
        }] : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imoveis_problematicos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['imoveis_resumo'] });
      const novasTentativas = contadorTentativas + 1;
      if (novasTentativas >= 3) {
        toast.warning('Imóvel marcado para sobrevoo de drone — 3ª tentativa registrada!', { duration: 5000 });
      } else {
        toast.success(`Tentativa registrada. ${novasTentativas} tentativa${novasTentativas !== 1 ? 's' : ''} neste imóvel.`);
      }
      onRegistered();
    },
    onError: () => toast.error('Erro ao registrar tentativa. Tente novamente.'),
  });

  async function handleSubmit() {
    if (!motivo) return;
    if (motivo === 'outro' && !observacao.trim()) {
      toast.error('Descreva o motivo no campo de observação ao selecionar "Outro".');
      return;
    }

    // Path offline: enfileira na IndexedDB (foto e upload ignorados sem rede)
    if (!navigator.onLine) {
      try {
        await enqueue({
          type: 'save_vistoria',
          createdAt: Date.now(),
          payload: {
            clienteId,
            imovelId,
            agenteId,
            ciclo,
            tipoAtividade: atividade,
            dataVisita: new Date().toISOString(),
            moradores_qtd: etapa1.moradores_qtd,
            gravidas: etapa1.gravidas,
            idosos: etapa1.idosos,
            criancas_7anos: etapa1.criancas_7anos,
            lat_chegada: etapa1.lat_chegada,
            lng_chegada: etapa1.lng_chegada,
            checkin_em: etapa1.checkin_em,
            observacao: null,
            acesso_realizado: false,
            status: 'revisita',
            motivo_sem_acesso: motivo,
            proximo_horario_sugerido: horario ?? null,
            observacao_acesso: observacao.trim() || null,
            foto_externa_url: null,
            idempotency_key: idempotencyKey,
            depositos: [],
            sintomas: null,
            riscos: null,
            tem_calha: vistoriaCalha,
            calha_inacessivel: false,
            calhas: vistoriaCalha
              ? [{ posicao: calhaPos, condicao: calhaCond, com_foco: calhaFoco }]
              : [],
            assinatura_responsavel_url: null,
          },
        });
        toast.success('Sem conexão — registro salvo localmente. Foto não incluída (requer conexão).');
        queryClient.invalidateQueries({ queryKey: ['imoveis_problematicos'] });
        queryClient.invalidateQueries({ queryKey: ['vistorias'] });
        queryClient.invalidateQueries({ queryKey: ['imoveis_resumo'] });
        onRegistered();
      } catch {
        toast.error('Erro ao salvar localmente. Tente novamente.');
      }
      return;
    }

    mutation.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Acesso não realizado</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Registre o motivo para rastreabilidade. Após 3 tentativas, o imóvel é marcado para sobrevoo.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Motivo do não acesso</p>
          <div className="grid grid-cols-2 gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all',
                  motivo === m
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
                )}
              >
                <span className={cn('shrink-0', motivo === m ? 'text-primary' : 'text-muted-foreground')}>
                  {MOTIVO_ICONS[m]}
                </span>
                <span className="text-[11px] font-semibold leading-tight">{MOTIVO_LABELS[m]}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => setVistoriaCalha(!vistoriaCalha)}
            className={cn(
              'flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all text-left',
              vistoriaCalha
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
            )}
          >
            <Wrench className={cn('w-5 h-5 shrink-0', vistoriaCalha ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-semibold flex-1">Dá para ver a calha/caixa d'água da rua?</span>
            <span className={cn('w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0', vistoriaCalha ? 'bg-primary border-primary justify-end' : 'bg-muted border-border justify-start')}>
              <span className="w-4 h-4 rounded-full bg-white shadow" />
            </span>
          </button>

          {vistoriaCalha && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">Mesmo sem entrar, registre o que foi possível ver.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posição</label>
                  <Select value={calhaPos} onValueChange={(v) => setCalhaPos(v as PosicaoCalha)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(POSICAO_CALHA_LABELS) as PosicaoCalha[]).map((p) => (
                        <SelectItem key={p} value={p}>{POSICAO_CALHA_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condição</label>
                  <Select value={calhaCond} onValueChange={(v) => setCalhaCondicao(v as CondicaoCalha)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONDICAO_CALHA_LABELS) as CondicaoCalha[]).map((c) => (
                        <SelectItem key={c} value={c}>{CONDICAO_CALHA_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalhaFoco(!calhaFoco)}
                className={cn(
                  'flex items-center gap-3 w-full p-3 rounded-xl border-2 transition-all text-left',
                  calhaFoco ? 'border-rose-400 bg-rose-50/40 text-rose-700' : 'border-border bg-card text-foreground',
                )}
              >
                <AlertTriangle className={cn('w-4 h-4 shrink-0', calhaFoco ? 'text-rose-500' : 'text-muted-foreground')} />
                <span className="text-sm font-semibold flex-1">Identificou possível foco na calha</span>
                <span className={cn('w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0', calhaFoco ? 'bg-rose-500 border-rose-500 justify-end' : 'bg-muted border-border justify-start')}>
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Melhor horário para retorno</p>
          <div className="grid grid-cols-2 gap-2">
            {HORARIOS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorario(horario === h ? null : h)}
                className={cn(
                  'p-3 rounded-xl border-2 text-sm font-semibold transition-all',
                  horario === h
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
                )}
              >
                {HORARIO_LABELS[h]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isRecusa ? (
        <Card className="rounded-2xl border-rose-200 bg-rose-50/30 dark:border-rose-800">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-rose-600" />
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                Foto da fachada — obrigatória para recusa
              </p>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="Fachada" className="w-full h-36 object-cover rounded-xl border border-rose-200" />
                <button
                  type="button"
                  onClick={clearFoto}
                  className="absolute top-2 right-2 w-6 h-6 bg-destructive text-white rounded-full text-xs flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 gap-2 rounded-xl border-rose-300 text-rose-700" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Da galeria
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1 gap-2 rounded-xl border-rose-300 text-rose-700" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4" /> Tirar foto
                </Button>
              </div>
            )}
            {!fotoPreview && !fotoFile && (
              <p className="text-xs text-rose-600 font-semibold">
                A foto da fachada é necessária para registrar a recusa formalmente.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Foto da fachada (evidência)</p>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="Fachada" className="w-full h-28 object-cover rounded-xl border border-border" />
                <button type="button" onClick={clearFoto} className="absolute top-2 right-2 w-6 h-6 bg-destructive text-white rounded-full text-xs flex items-center justify-center font-bold">✕</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Galeria
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-3.5 h-3.5" /> Câmera
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={cn('rounded-2xl', motivo === 'outro' && !observacao.trim() ? 'border-rose-300 dark:border-rose-700' : 'border-border')}>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Observação{motivo === 'outro' && <span className="text-rose-500 ml-1">* obrigatório</span>}
          </p>
          <Textarea
            placeholder={motivo === 'outro' ? 'Descreva o motivo com detalhes...' : 'Descreva a situação encontrada...'}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="rounded-xl min-h-[80px]"
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onCancel}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <Button
          className="flex-1 h-12 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
          disabled={!motivo || mutation.isPending || (isRecusa && !fotoFile && !fotoPreview) || (motivo === 'outro' && !observacao.trim()) || !!tenantStatus?.isBlocked}
          onClick={() => void handleSubmit()}
        >
          {mutation.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Registrando...
            </span>
          ) : (
            'Registrar sem acesso'
          )}
        </Button>
      </div>
    </div>
  );
}
