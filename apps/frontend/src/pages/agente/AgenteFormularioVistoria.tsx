import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, WifiOff, Cloud, ThumbsUp, ThumbsDown, UserCheck } from 'lucide-react';
import {
  salvarRascunho,
  salvarRascunhoEmergencia,
  carregarRascunho,
  limparRascunho,
  formatarTempoRascunho,
  type VistoriaRascunho,
} from '@/lib/vistoriaRascunho';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { invokeUploadEvidencia } from '@/lib/uploadEvidencia';
import { getCurrentCiclo } from '@/lib/ciclo';
import {
  useVistoriasByImovel,
} from '@/hooks/queries/useVistorias';
import { useFocosDoImovel } from '@/hooks/queries/useFocosRisco';

import { VistoriaEtapaPre, ETAPA_PRE_DEFAULT, type EtapaPreData } from '@/components/vistoria/VistoriaEtapaPre';
import { VistoriaEtapa1Responsavel, type Etapa1Data } from '@/components/vistoria/VistoriaEtapa1Responsavel';
import { VistoriaSemAcesso } from '@/components/vistoria/VistoriaSemAcesso';
import { VistoriaEtapa2Sintomas, type Etapa2Data } from '@/components/vistoria/VistoriaEtapa2Sintomas';
import {
  VistoriaEtapa3Inspecao,
  createEtapa3Default,
  type Etapa3Data,
} from '@/components/vistoria/VistoriaEtapa3Inspecao';
import {
  VistoriaEtapa4Tratamento,
  createEtapa4Default,
  type Etapa4Data,
} from '@/components/vistoria/VistoriaEtapa4Tratamento';
import { VistoriaEtapa5Riscos, ETAPA5_DEFAULT, type Etapa5Data } from '@/components/vistoria/VistoriaEtapa5Riscos';
import { VistoriaConfirmacao } from '@/components/vistoria/VistoriaConfirmacao';
import type { TipoAtividade, FocoRiscoOrigem } from '@/types/database';
import { enqueue } from '@/lib/offlineQueue';
import { STALE } from '@/lib/queryConfig';

const ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  tratamento: 'Tratamento',
  pesquisa: 'Pesquisa',
  liraa: 'LIRAa',
  ponto_estrategico: 'Ponto Estratégico',
};

/** key = índice do componente de etapa (-1=pré, 0-4=etapas principais), label = rótulo exibido */
const ETAPAS_POR_ATIVIDADE: Record<TipoAtividade, { label: string; key: number }[]> = {
  tratamento: [
    { label: 'Registro',    key: -1 },
    { label: 'Responsável', key: 0 },
    { label: 'Sintomas',    key: 1 },
    { label: 'Inspeção',    key: 2 },
    { label: 'Tratamento',  key: 3 },
    { label: 'Riscos',      key: 4 },
  ],
  pesquisa: [
    { label: 'Registro',    key: -1 },
    { label: 'Responsável', key: 0 },
    { label: 'Sintomas',    key: 1 },
    { label: 'Inspeção',    key: 2 },
    { label: 'Tratamento',  key: 3 },
    { label: 'Riscos',      key: 4 },
  ],
  liraa: [
    { label: 'Identificação', key: 0 },
    { label: 'Depósitos',     key: 2 },
    { label: 'Riscos',        key: 4 },
  ],
  ponto_estrategico: [
    { label: 'Checkin',      key: 0 },
    { label: 'Inspeção',     key: 2 },
    { label: 'Observações',  key: 4 },
  ],
};

const ETAPA1_DEFAULT: Etapa1Data = {
  moradores_qtd: 0,
  gravidas: false,
  idosos: false,
  criancas_7anos: false,
  lat_chegada: null,
  lng_chegada: null,
  checkin_em: null,
};

const ETAPA2_DEFAULT: Etapa2Data = {
  febre: false,
  manchas_vermelhas: false,
  dor_articulacoes: false,
  dor_cabeca: false,
  moradores_sintomas_qtd: 0,
};

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const msg = typeof e.message === 'string' ? e.message : '';
    const code = typeof e.code === 'string' ? e.code : '';
    const details = typeof e.details === 'string' ? e.details : '';
    const hint = typeof e.hint === 'string' ? e.hint : '';
    const parts = [msg, code ? `code=${code}` : '', details ? `details=${details}` : '', hint ? `hint=${hint}` : '']
      .filter(Boolean)
      .join(' | ');
    if (parts) return parts;
    try {
      return JSON.stringify(e);
    } catch {
      return 'Erro desconhecido ao serializar payload de erro.';
    }
  }
  return 'Erro desconhecido ao salvar vistoria.';
}

/** Mapeia origem_tipo do foco → origem_visita da vistoria (quando mapeável, bloqueia seleção). */
const FOCO_ORIGEM_MAP: Partial<Record<FocoRiscoOrigem, 'denuncia' | 'liraa' | 'drone'>> = {
  drone:   'drone',
  cidadao: 'denuncia',
};

export default function AgenteFormularioVistoria() {
  const { imovelId: imovelIdParam } = useParams<{ imovelId: string }>();
  const [searchParams] = useSearchParams();
  const atividade = (searchParams.get('atividade') as TipoAtividade) || 'pesquisa';
  const focoId = searchParams.get('focoId');

  const navigate = useNavigate();
  const { clienteId, tenantStatus } = useClienteAtivo();
  const { usuario } = useAuth();
  const agenteId = usuario?.id ?? null;
  const queryClient = useQueryClient();

  // Busca dados do foco (quando vistoria é vinculada a um foco_risco sem imovel obrigatório)
  const { data: focoParaVistoria } = useQuery({
    queryKey: ['foco-para-vistoria', focoId],
    queryFn: () => api.focosRisco.getPorId(focoId!),
    enabled: !!focoId,
    staleTime: STALE.LONG,
  });

  // imovelId efetivo: parâmetro da URL > imovel_id do foco > undefined
  const imovelId = imovelIdParam ?? focoParaVistoria?.imovel_id ?? undefined;

  // Se o foco tem origem conhecida, pré-seleciona e bloqueia a origem da visita
  const origemFoco = focoParaVistoria ? (FOCO_ORIGEM_MAP[focoParaVistoria.origem_tipo] ?? null) : null;
  const origemLocked = !!origemFoco;

  const currentCiclo = getCurrentCiclo();

  // Busca endereço do imóvel para exibir no header do stepper (confirma qual imóvel está sendo vistoriado)
  const { data: imovelInfo } = useQuery({
    queryKey: ['imovel-header', imovelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('imoveis')
        .select('logradouro, numero, bairro')
        .eq('id', imovelId!)
        .single();
      return data ?? null;
    },
    enabled: !!imovelId,
    staleTime: STALE.LONG,
  });

  const imovelLabel = imovelInfo
    ? `${imovelInfo.logradouro}, ${imovelInfo.numero}${imovelInfo.bairro ? ` · ${imovelInfo.bairro}` : ''}`
    : focoParaVistoria?.endereco_normalizado ?? null;

  const etapasAtivas = ETAPAS_POR_ATIVIDADE[atividade] ?? ETAPAS_POR_ATIVIDADE.pesquisa;

  const [etapa, setEtapa] = useState(0);
  const [done, setDone] = useState(false);
  const [wasSemAcesso, setWasSemAcesso] = useState(false);
  const [semAcessoMode, setSemAcessoMode] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [focoClassificado, setFocoClassificado] = useState<'confirmado' | 'descartado' | 'resolvido' | null>(null);
  const [focoClassificando, setFocoClassificando] = useState(false);
  // Gerada uma vez por montagem — garante idempotência no RPC (evita 409 em retry/double-click)
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // ── Comandos de voz para navegação entre etapas (Módulo 5.3) ─────────────
  const etapaRef = useRef(etapa);
  etapaRef.current = etapa;
  const etapasAtivasRef = useRef(etapasAtivas);
  etapasAtivasRef.current = etapasAtivas;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window.SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition);
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const texto = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      if (texto.includes('próxima etapa') || texto.includes('avançar')) {
        setEtapa((e) => Math.min(etapasAtivasRef.current.length - 1, e + 1));
      } else if (texto.includes('etapa anterior') || texto.includes('voltar')) {
        setEtapa((e) => Math.max(0, e - 1));
      } else if (texto.includes('sem acesso')) {
        setSemAcessoMode(true);
      }
    };
    recognition.onerror = () => { /* silencioso */ };
    recognition.start();
    return () => { try { recognition.stop(); } catch { /* ignore */ } };
  }, []);

  const [etapaPre, setEtapaPre] = useState<EtapaPreData>(ETAPA_PRE_DEFAULT);

  // Pré-seleciona origem_visita a partir do tipo do foco (apenas uma vez, quando os dados chegam)
  useEffect(() => {
    if (origemFoco) {
      setEtapaPre((prev) => prev.origem_visita === null ? { ...prev, origem_visita: origemFoco } : prev);
    }
  }, [origemFoco]); // eslint-disable-line react-hooks/exhaustive-deps
  const [etapa1, setEtapa1] = useState<Etapa1Data>(ETAPA1_DEFAULT);
  const [etapa2, setEtapa2] = useState<Etapa2Data>(ETAPA2_DEFAULT);
  const [etapa3, setEtapa3] = useState<Etapa3Data>(createEtapa3Default());
  const [etapa4, setEtapa4] = useState<Etapa4Data>({ tratamentos: [] });
  const [etapa5, setEtapa5] = useState<Etapa5Data>(ETAPA5_DEFAULT);

  // Auto-classifica foco ao concluir vistoria
  // - focos encontrados + tratamento aplicado (qtd_eliminados > 0) → confirmado → em_tratamento → resolvido
  // - focos encontrados + sem tratamento → confirmado (aguarda ação posterior)
  // - sem focos → descartado
  const temFocosEncontrados = etapa3.depositos.some((d) => d.qtd_com_focos > 0);
  const tratamentoAplicado = etapa4.tratamentos.reduce((sum, t) => sum + (t.qtd_eliminados ?? 0), 0) > 0;
  useEffect(() => {
    if (!done || wasSemAcesso || !focoId || focoClassificado || focoClassificando) return;
    setFocoClassificando(true);

    if (temFocosEncontrados && tratamentoAplicado) {
      api.focosRisco.transicionar(focoId, 'confirmado', undefined, undefined)
        .then(() => api.focosRisco.transicionar(focoId, 'em_tratamento', undefined, undefined))
        .then(() => api.focosRisco.transicionar(focoId, 'resolvido', undefined, undefined))
        .then(() => {
          setFocoClassificado('resolvido');
          toast.success('Foco resolvido — tratamento aplicado na vistoria.');
        })
        .catch(() => {
          toast.error('Falha ao registrar resolução do foco. Verifique a conexão.');
        })
        .finally(() => setFocoClassificando(false));
    } else {
      const resultado: 'confirmado' | 'descartado' = temFocosEncontrados ? 'confirmado' : 'descartado';
      api.focosRisco.transicionar(focoId, resultado, undefined, undefined)
        .then(() => {
          setFocoClassificado(resultado);
          toast.success(
            resultado === 'confirmado'
              ? 'Foco confirmado — larvas encontradas, tratamento pendente.'
              : 'Foco descartado — nenhuma larva encontrada.',
          );
        })
        .catch(() => {
          toast.error('Falha ao classificar o foco automaticamente.');
        })
        .finally(() => setFocoClassificando(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // ── Autosave / rascunho ────────────────────────────────────────────────────
  type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [rascunhoPendente, setRascunhoPendente] = useState<VistoriaRascunho | null>(null);

  // Ref com estado atual para leitores síncronos (pagehide / visibilitychange).
  // Atualizado em cada render — sem useEffect — para sempre refletir o valor mais recente.
  const dadosAtuaisRef = useRef({
    imovelId, agenteId, atividade, etapa,
    etapaPre, etapa1, etapa2, etapa3, etapa4, etapa5,
    done: false, rascunhoPendente: null as VistoriaRascunho | null,
  });

  // Carrega rascunho ao montar (apenas uma vez) — async (IndexedDB)
  useEffect(() => {
    if (!imovelId || !agenteId) return;
    carregarRascunho(imovelId, agenteId).then((draft) => {
      if (draft) setRascunhoPendente(draft);
    }).catch(() => {/* silencioso */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Status offline em tempo real
  useEffect(() => {
    const goOffline = () => setSaveStatus('offline');
    const goOnline  = () => setSaveStatus((s) => s === 'offline' ? 'saved' : s);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    if (!navigator.onLine) setSaveStatus('offline');
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, []);

  // Mantém ref com valores mais recentes para save síncrono em pagehide/visibilitychange.
  // Executa em cada render (sem array de deps) para nunca ficar desatualizado.
  dadosAtuaisRef.current = {
    imovelId, agenteId, atividade, etapa,
    etapaPre, etapa1, etapa2, etapa3, etapa4, etapa5,
    done, rascunhoPendente,
  };

  // Salva imediatamente ao perder o foco (fechar aba, trocar de app, bloqueio de tela).
  // Usa salvarRascunhoEmergencia (sync/localStorage) porque IndexedDB pode não concluir
  // antes do browser encerrar a página no pagehide. A próxima abertura migrará para IndexedDB.
  useEffect(() => {
    const salvarImediato = () => {
      const d = dadosAtuaisRef.current;
      if (d.done || !d.imovelId || !d.agenteId || d.rascunhoPendente) return;
      salvarRascunhoEmergencia({
        imovelId: d.imovelId,
        agenteId: d.agenteId,
        atividade: d.atividade,
        status: 'em_andamento',
        etapa: d.etapa,
        etapaPre: d.etapaPre,
        etapa1: d.etapa1,
        etapa2: d.etapa2,
        etapa3: d.etapa3,
        etapa4: d.etapa4,
        etapa5: d.etapa5,
        savedAt: new Date().toISOString(),
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') salvarImediato();
    };
    window.addEventListener('pagehide', salvarImediato);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      // Salva também ao desmontar o componente (navegação programática)
      salvarImediato();
      window.removeEventListener('pagehide', salvarImediato);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave debounced — salva 1.5s após última mudança
  useEffect(() => {
    if (!imovelId || !agenteId || rascunhoPendente) return; // não sobrescreve enquanto pergunta
    setSaveStatus((s) => s === 'offline' ? 'offline' : 'saving');
    const t = setTimeout(() => {
      void salvarRascunho({
        imovelId, agenteId, clienteId: clienteId ?? undefined, atividade,
        status: 'em_andamento', etapa,
        etapaPre, etapa1, etapa2, etapa3, etapa4, etapa5,
        savedAt: new Date().toISOString(),
      }).then(() => {
        setSaveStatus((s) => s === 'offline' ? 'offline' : 'saved');
      }).catch(() => {
        setSaveStatus((s) => s === 'offline' ? 'offline' : 'saved'); // fallback localStorage já tentou
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [imovelId, agenteId, atividade, etapa, etapaPre, etapa1, etapa2, etapa3, etapa4, etapa5]); // eslint-disable-line react-hooks/exhaustive-deps

  function aplicarRascunho(draft: VistoriaRascunho) {
    setEtapaPre(draft.etapaPre);
    setEtapa1(draft.etapa1);
    setEtapa2(draft.etapa2);
    setEtapa3(draft.etapa3);
    setEtapa4(draft.etapa4);
    setEtapa5(draft.etapa5);
    setEtapa(draft.etapa);
    setRascunhoPendente(null);
  }

  function descartarRascunho() {
    if (imovelId && agenteId) void limparRascunho(imovelId, agenteId);
    setRascunhoPendente(null);
  }

  const { data: vistoriasDoImovel = [] } = useVistoriasByImovel(imovelId, clienteId);
  const { data: focosDoImovel = [] } = useFocosDoImovel(imovelId, clienteId);
  const focosAguardandoInspecao = focosDoImovel.filter((f) => f.status === 'aguarda_inspecao');
  const [isSaving, setIsSaving] = useState(false);

  // Bloqueia apenas se o agente JÁ FINALIZOU a vistoria HOJE — evita duplicata no mesmo dia.
  // Não bloqueia re-visitas em dias diferentes dentro do mesmo ciclo (retorno após sem-acesso,
  // ou acompanhamento de foco ativo confirmado em data anterior).
  const hoje = new Date().toISOString().slice(0, 10);
  const jaFinalizadoNoCiclo = vistoriasDoImovel.some(
    (v) =>
      v.agente_id === agenteId &&
      v.ciclo === currentCiclo &&
      (v.status === 'visitado' || v.status === 'fechado') &&
      v.data_visita.slice(0, 10) === hoje,
  );

  // Ao avançar da etapa Inspeção → Tratamento: recalcular etapa4 a partir dos focos encontrados
  function handleEtapa3Next() {
    const nextStep = etapasAtivas[etapa + 1];
    if (nextStep?.key === 3) {
      // próxima etapa é Tratamento — recalcular
      setEtapa4(createEtapa4Default(etapa3.depositos, atividade));
    }
    setEtapa((e) => e + 1);
  }

  const handleFinalize = useCallback(async (assinaturaDataUrl?: string) => {
    if (isSaving) return;

    if (!clienteId || !agenteId) {
      toast.error('Dados incompletos para salvar a vistoria.');
      return;
    }

    if (!assinaturaDataUrl) {
      toast.error('Assinatura obrigatória — solicite ao responsável antes de finalizar.');
      return;
    }

    // ── Modo offline: enfileira tudo no IndexedDB e conclui localmente ──────────
    if (!navigator.onLine) {
      setIsSaving(true); // bloqueia re-entrada durante enqueue assíncrono
      const depositosAtivos = etapa3.depositos.filter(
        (d) => d.qtd_inspecionados > 0 || d.qtd_com_agua > 0 || d.qtd_com_focos > 0,
      );
      const algumSintoma =
        etapa2.febre || etapa2.manchas_vermelhas || etapa2.dor_articulacoes ||
        etapa2.dor_cabeca || etapa2.moradores_sintomas_qtd > 0;
      const { observacao: _obs2, ...riscosBooleans2 } = etapa5;
      const algumRisco = Object.values(riscosBooleans2).some(
        (v) => (typeof v === 'boolean' && v) || (typeof v === 'string' && v.trim()),
      );
      await enqueue({
        type: 'save_vistoria',
        createdAt: Date.now(),
        payload: {
          clienteId,
          imovelId,
          agenteId,
          ciclo: currentCiclo,
          tipoAtividade: atividade,
          origem_visita: etapaPre.origem_visita,
          habitat_selecionado: etapaPre.habitat_selecionado,
          condicao_habitat: etapaPre.condicao_habitat,
          dataVisita: new Date().toISOString(),
          moradores_qtd: etapa1.moradores_qtd,
          gravidas: etapa1.gravidas,
          idosos: etapa1.idosos,
          criancas_7anos: etapa1.criancas_7anos,
          lat_chegada: etapa1.lat_chegada,
          lng_chegada: etapa1.lng_chegada,
          checkin_em: etapa1.checkin_em,
          observacao: etapa5.observacao || null,
          depositos: depositosAtivos.map((dep) => {
            const trat = etapa4.tratamentos.find((t) => t.tipo === dep.tipo);
            return {
              tipo: dep.tipo,
              qtd_inspecionados: dep.qtd_inspecionados,
              qtd_com_agua: dep.qtd_com_agua,
              qtd_com_focos: dep.qtd_com_focos,
              eliminado: dep.eliminado,
              vedado: dep.vedado,
              qtd_eliminados: trat?.qtd_eliminados ?? 0,
              usou_larvicida: trat?.usou_larvicida ?? false,
              qtd_larvicida_g: trat?.qtd_larvicida_g ?? null,
              ia_identificacao: dep.ia_identificacao ?? null,
            };
          }),
          sintomas: algumSintoma ? {
            febre: etapa2.febre,
            manchas_vermelhas: etapa2.manchas_vermelhas,
            dor_articulacoes: etapa2.dor_articulacoes,
            dor_cabeca: etapa2.dor_cabeca,
            moradores_sintomas_qtd: etapa2.moradores_sintomas_qtd,
          } : null,
          riscos: algumRisco ? {
            vistoria_id: '',
            menor_incapaz: etapa5.menor_incapaz,
            idoso_incapaz: etapa5.idoso_incapaz,
            dep_quimico: etapa5.dep_quimico,
            risco_alimentar: etapa5.risco_alimentar,
            risco_moradia: etapa5.risco_moradia,
            criadouro_animais: etapa5.criadouro_animais,
            lixo: etapa5.lixo,
            residuos_organicos: etapa5.residuos_organicos,
            residuos_quimicos: etapa5.residuos_quimicos,
            residuos_medicos: etapa5.residuos_medicos,
            acumulo_material_organico: etapa5.acumulo_material_organico,
            animais_sinais_lv: etapa5.animais_sinais_lv,
            caixa_destampada: etapa5.caixa_destampada,
            outro_risco_vetorial: etapa5.outro_risco_vetorial.trim() || null,
          } : null,
          tem_calha: etapa3.tem_calha,
          calha_inacessivel: etapa3.calha_inacessivel,
          calhas: etapa3.tem_calha ? etapa3.calhas : [],
          // assinatura_responsavel_url não pode ser enviada offline (requer upload Cloudinary)
          assinatura_responsavel_url: null,
        },
      });
      toast.success('Sem conexão — dados salvos localmente e serão enviados ao reconectar. Assinatura digital não incluída (requer conexão).');
      if (imovelId && agenteId) void limparRascunho(imovelId, agenteId);
      void queryClient.invalidateQueries({ queryKey: ['imoveis_resumo'] });
      void queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      setDone(true);
      return;
    }

    // ── Modo online: persistência transacional via RPC ──────────────────────
    setIsSaving(true);
    try {
      // Upload assinatura via Edge Function antes de chamar o RPC (M-02/F-07)
      let assinaturaUrl: string | null = null;
      let assinaturaPublicId: string | null = null;
      if (assinaturaDataUrl) {
        try {
          const base64 = assinaturaDataUrl.split(',')[1];
          const mimeMatch = assinaturaDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
          const mime = (mimeMatch?.[1] ?? 'image/png').toLowerCase();
          const extAssinatura =
            mime.includes('png') ? 'png'
            : mime.includes('webp') ? 'webp'
            : mime.includes('gif') ? 'gif'
            : 'jpg';
          const up = await invokeUploadEvidencia({
            file_base64: base64,
            filename: `assinatura_${agenteId}_${Date.now()}.${extAssinatura}`,
            folder: 'assinaturas',
          });
          if ('url' in up) {
            assinaturaUrl = up.url;
            assinaturaPublicId = up.public_id ?? null;
            toast.success('Assinatura enviada com sucesso.');
          } else {
            toast.warning('Não foi possível enviar a assinatura. A vistoria será salva sem assinatura.');
          }
        } catch {
          toast.warning('Falha no envio da assinatura. A vistoria será salva sem assinatura.');
        }
      }
      const depositosAtivos = etapa3.depositos.filter(
        (d) => d.qtd_inspecionados > 0 || d.qtd_com_agua > 0 || d.qtd_com_focos > 0,
      );

      const algumSintoma =
        etapa2.febre || etapa2.manchas_vermelhas ||
        etapa2.dor_articulacoes || etapa2.dor_cabeca ||
        etapa2.moradores_sintomas_qtd > 0;

      const { observacao: _obs, ...riscosBooleans } = etapa5;
      const algumRisco = Object.values(riscosBooleans).some(
        (v) => (typeof v === 'boolean' && v) || (typeof v === 'string' && v.trim()),
      );

      const vistoriaId = await api.vistorias.createCompleta({
        cliente_id: clienteId,
        imovel_id: imovelId,
        agente_id: agenteId,
        ciclo: currentCiclo,
        tipo_atividade: atividade,
        data_visita: new Date().toISOString(),
        status: 'visitado',
        moradores_qtd: etapa1.moradores_qtd,
        gravidas: etapa1.gravidas,
        idosos: etapa1.idosos,
        criancas_7anos: etapa1.criancas_7anos,
        lat_chegada: etapa1.lat_chegada,
        lng_chegada: etapa1.lng_chegada,
        checkin_em: etapa1.checkin_em,
        observacao: etapa5.observacao || null,
        acesso_realizado: true,
        origem_visita: etapaPre.origem_visita,
        habitat_selecionado: etapaPre.habitat_selecionado,
        condicao_habitat: etapaPre.condicao_habitat,
        assinatura_responsavel_url: assinaturaUrl,
        assinatura_public_id: assinaturaPublicId,
        foco_risco_id: focoId ?? null,
        idempotency_key: idempotencyKey,
        depositos: depositosAtivos.map((dep) => {
          const trat = etapa4.tratamentos.find((t) => t.tipo === dep.tipo);
          return {
            tipo: dep.tipo,
            qtd_inspecionados: dep.qtd_inspecionados,
            qtd_com_agua: dep.qtd_com_agua,
            qtd_com_focos: dep.qtd_com_focos,
            eliminado: dep.eliminado,
            vedado: dep.vedado,
            qtd_eliminados: trat?.qtd_eliminados ?? 0,
            usou_larvicida: trat?.usou_larvicida ?? false,
            qtd_larvicida_g: trat?.qtd_larvicida_g ?? null,
            ia_identificacao: dep.ia_identificacao ?? null,
          };
        }),
        sintomas: algumSintoma ? {
          febre: etapa2.febre,
          manchas_vermelhas: etapa2.manchas_vermelhas,
          dor_articulacoes: etapa2.dor_articulacoes,
          dor_cabeca: etapa2.dor_cabeca,
          moradores_sintomas_qtd: etapa2.moradores_sintomas_qtd,
        } : null,
        riscos: algumRisco ? {
          menor_incapaz: etapa5.menor_incapaz,
          idoso_incapaz: etapa5.idoso_incapaz,
          dep_quimico: etapa5.dep_quimico,
          risco_alimentar: etapa5.risco_alimentar,
          risco_moradia: etapa5.risco_moradia,
          criadouro_animais: etapa5.criadouro_animais,
          lixo: etapa5.lixo,
          residuos_organicos: etapa5.residuos_organicos,
          residuos_quimicos: etapa5.residuos_quimicos,
          residuos_medicos: etapa5.residuos_medicos,
          acumulo_material_organico: etapa5.acumulo_material_organico,
          animais_sinais_lv: etapa5.animais_sinais_lv,
          caixa_destampada: etapa5.caixa_destampada,
          outro_risco_vetorial: etapa5.outro_risco_vetorial.trim() || null,
        } : null,
        tem_calha: etapa3.tem_calha,
        calha_inacessivel: etapa3.calha_inacessivel,
        calhas: etapa3.tem_calha ? etapa3.calhas : [],
      });

      // QW-10B: persiste public_id da assinatura para rastreabilidade Cloudinary
      if (assinaturaPublicId && vistoriaId) {
        await api.vistorias.atualizarPublicIds(vistoriaId, { assinatura_public_id: assinaturaPublicId })
          .catch(() => { /* best-effort — não bloqueia conclusão da vistoria */ });
      }

      if (imovelId && agenteId) void limparRascunho(imovelId, agenteId);
      void queryClient.invalidateQueries({ queryKey: ['imoveis_resumo'] });
      void queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      setDone(true);
    } catch (err) {
      const message = extractErrorMessage(err);
      console.error('[AgenteFormularioVistoria] erro ao finalizar', err);
      toast.error(`Erro ao salvar vistoria: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [clienteId, agenteId, imovelId, atividade, etapaPre, etapa1, etapa2, etapa3, etapa4, etapa5]);

  if (done) {
    // ── Quando veio de um foco atribuído: pedir classificação antes do sucesso ──
    if (focoId && !focoClassificado) {
      async function classificarFoco(resultado: 'confirmado' | 'descartado') {
        setFocoClassificando(true);
        try {
          await api.focosRisco.transicionar(focoId!, resultado, undefined, undefined);
          setFocoClassificado(resultado);
          toast.success(resultado === 'confirmado' ? 'Foco confirmado.' : 'Foco descartado.');
        } catch {
          toast.error('Falha ao classificar o foco. Tente novamente.');
        } finally {
          setFocoClassificando(false);
        }
      }

      // ── Sem acesso: agente não entrou no imóvel — não pode confirmar foco ──
      if (wasSemAcesso) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
            <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-6">
              <UserCheck className="w-14 h-14 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sem acesso registrado</h1>
              <p className="text-muted-foreground mt-1 text-sm max-w-xs">
                O agente não acessou o imóvel. O foco não pode ser confirmado sem inspeção.
                <br />O que deseja fazer com o foco?
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                className="w-full rounded-xl h-12 font-bold gap-2"
                disabled={focoClassificando}
                onClick={() => navigate('/agente/hoje')}
              >
                <UserCheck className="w-4 h-4" />
                Manter para nova inspeção
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl h-12 font-bold border-destructive text-destructive hover:bg-destructive/10 gap-2"
                disabled={focoClassificando}
                onClick={() => classificarFoco('descartado')}
              >
                <ThumbsDown className="w-4 h-4" />
                Descartar foco (endereço inválido)
              </Button>
            </div>
            {focoClassificando && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
              </p>
            )}
          </div>
        );
      }

      // ── Com acesso: classificação automática em andamento ──
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
          <div className="rounded-full bg-blue-100 dark:bg-blue-950 p-6">
            <Loader2 className="w-14 h-14 text-blue-600 animate-spin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Processando resultado...</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Registrando o resultado da vistoria automaticamente.
            </p>
          </div>
        </div>
      );
    }

    // ── Tela de sucesso padrão (sem focoId ou após classificar) ──────────────
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
        <div className="rounded-full bg-emerald-100 dark:bg-emerald-950 p-6">
          <CheckCircle2 className="w-14 h-14 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {focoClassificado === 'resolvido'
              ? 'Foco resolvido!'
              : focoClassificado === 'confirmado'
              ? 'Foco confirmado!'
              : focoClassificado === 'descartado'
              ? 'Foco descartado.'
              : 'Vistoria concluída!'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {focoClassificado === 'resolvido'
              ? 'Tratamento aplicado e foco encerrado com sucesso.'
              : 'Os dados foram registrados com sucesso.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button className="w-full rounded-xl h-11 font-bold" onClick={() => navigate('/agente/imoveis')}>
            Próximo imóvel
          </Button>
          <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => navigate('/agente/hoje')}>
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  if (jaFinalizadoNoCiclo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <h1 className="text-xl font-bold text-foreground">Imóvel já finalizado</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Este imóvel já foi marcado como vistoriado neste ciclo para este agente.
        </p>
        <Button className="rounded-xl h-11 px-6" onClick={() => navigate('/agente/imoveis')}>
          Voltar para lista de imóveis
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Dialog de restauração de rascunho ── */}
      {rascunhoPendente && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 px-5">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Rascunho encontrado</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Há uma vistoria salva {formatarTempoRascunho(rascunhoPendente.savedAt)}.
                  Deseja continuar de onde parou?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="rounded-xl h-11"
                onClick={descartarRascunho}
              >
                Descartar
              </Button>
              <Button
                className="rounded-xl h-11 font-bold"
                onClick={() => aplicarRascunho(rascunhoPendente)}
              >
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => (etapa > 0 ? setEtapa(etapa - 1) : navigate(-1))}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base leading-tight">
            {etapasAtivas[etapa]?.label ?? ''}
          </h1>
          {imovelLabel ? (
            <p className="text-xs text-muted-foreground truncate">
              {imovelLabel}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Etapa {etapa + 1} de {etapasAtivas.length} · {ATIVIDADE_LABEL[atividade]}
            </p>
          )}
        </div>
        {/* Save status indicator */}
        <div className="shrink-0">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <Cloud className="w-3 h-3" /> Salvo
            </span>
          )}
          {saveStatus === 'offline' && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Alerta de focos aguardando inspeção */}
      {focosAguardandoInspecao.length > 0 && (
        <div className="px-4 pt-4">
          <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  {focosAguardandoInspecao.length} foco(s) aguardando inspeção neste imóvel
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Prioridade: {focosAguardandoInspecao[0].prioridade} · Esta vistoria será vinculada automaticamente ao foco.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress pills */}
      <div className="px-4 pt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {etapasAtivas[etapa]?.label ?? ''}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {etapa + 1} / {etapasAtivas.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          {etapasAtivas.map((_e, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < etapa
                  ? 'bg-emerald-500'
                  : i === etapa
                  ? 'bg-primary'
                  : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
        {semAcessoMode ? (
          <VistoriaSemAcesso
            clienteId={clienteId!}
            imovelId={imovelId!}
            agenteId={agenteId!}
            atividade={atividade}
            ciclo={currentCiclo}
            etapa1={etapa1}
            onRegistered={() => { setWasSemAcesso(true); setDone(true); }}
            onCancel={() => setSemAcessoMode(false)}
          />
        ) : (
          <>
            {(() => {
              const stepKey = etapasAtivas[etapa]?.key ?? 0;
              return (
                <>
                  {stepKey === -1 && (
                    <VistoriaEtapaPre
                      data={etapaPre}
                      onChange={setEtapaPre}
                      onNext={() => setEtapa((e) => e + 1)}
                      origemLocked={origemLocked}
                    />
                  )}
                  {stepKey === 0 && (
                    <VistoriaEtapa1Responsavel
                      data={etapa1}
                      onChange={setEtapa1}
                      onNext={() => setEtapa((e) => e + 1)}
                      onSemAcesso={() => setSemAcessoMode(true)}
                    />
                  )}
                  {stepKey === 1 && (
                    <VistoriaEtapa2Sintomas
                      data={etapa2}
                      onChange={setEtapa2}
                      onNext={() => setEtapa((e) => e + 1)}
                    />
                  )}
                  {stepKey === 2 && (
                    <VistoriaEtapa3Inspecao
                      data={etapa3}
                      onChange={setEtapa3}
                      onNext={handleEtapa3Next}
                    />
                  )}
                  {stepKey === 3 && (
                    <VistoriaEtapa4Tratamento
                      depositos={etapa3.depositos}
                      data={etapa4}
                      onChange={setEtapa4}
                      onNext={() => setEtapa((e) => e + 1)}
                      atividade={atividade}
                    />
                  )}
                  {stepKey === 4 && !showConfirmacao && (
                    <VistoriaEtapa5Riscos
                      data={etapa5}
                      onChange={setEtapa5}
                      onPreFinalize={() => setShowConfirmacao(true)}
                      isSaving={isSaving}
                      isBlocked={!!tenantStatus?.isBlocked}
                    />
                  )}
                  {stepKey === 4 && showConfirmacao && (
                    <VistoriaConfirmacao
                      etapa1={etapa1}
                      etapa2={etapa2}
                      etapa3={etapa3}
                      etapa4={etapa4}
                      etapa5={etapa5}
                      isSaving={isSaving}
                      onConfirm={(assinatura) => handleFinalize(assinatura)}
                      onBack={() => setShowConfirmacao(false)}
                    />
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
