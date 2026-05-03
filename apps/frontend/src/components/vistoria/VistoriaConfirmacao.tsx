import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Users, Layers, FlaskConical, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DEPOSITO_LABELS } from '@/types/database';
import { AssinaturaDigital } from './AssinaturaDigital';
import type { Etapa1Data } from './VistoriaEtapa1Responsavel';
import type { Etapa2Data } from './VistoriaEtapa2Sintomas';
import type { Etapa3Data } from './VistoriaEtapa3Inspecao';
import type { Etapa4Data } from './VistoriaEtapa4Tratamento';
import type { Etapa5Data } from './VistoriaEtapa5Riscos';

interface Props {
  etapa1: Etapa1Data;
  etapa2: Etapa2Data;
  etapa3: Etapa3Data;
  etapa4: Etapa4Data;
  etapa5: Etapa5Data;
  isSaving: boolean;
  onConfirm: (assinaturaDataUrl?: string) => void;
  onBack: () => void;
}

function Row({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-bold', danger ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{value}</span>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-0.5">
      <span className="text-primary">{icon}</span>
      <p className="text-xs font-bold text-primary uppercase tracking-wider">{label}</p>
    </div>
  );
}

export function VistoriaConfirmacao({ etapa1, etapa2, etapa3, etapa4, etapa5, isSaving, onConfirm, onBack }: Props) {
  // Armazena a assinatura capturada localmente; só envia ao clicar em "Finalizar"
  const [assinaturaCapturada, setAssinaturaCapturada] = useState<string | undefined>(undefined);

  const totalFocos = etapa3.depositos.reduce((s, d) => s + d.qtd_com_focos, 0);
  const totalInspec = etapa3.depositos.reduce((s, d) => s + d.qtd_inspecionados, 0);
  const totalAgua = etapa3.depositos.reduce((s, d) => s + d.qtd_com_agua, 0);
  const totalEliminados = etapa4.tratamentos.reduce((s, t) => s + t.qtd_eliminados, 0);
  const algumSintoma = etapa2.febre || etapa2.manchas_vermelhas || etapa2.dor_articulacoes || etapa2.dor_cabeca;

  const { observacao: _obs, outro_risco_vetorial, ...riscosBool } = etapa5;
  const riscoAtivo = Object.entries(riscosBool).filter(([, v]) => v === true).map(([k]) => k);
  const temRisco = riscoAtivo.length > 0 || outro_risco_vetorial?.trim();

  const depositosComFoco = etapa3.depositos.filter((d) => d.qtd_com_focos > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5">
        <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">Confira antes de salvar</p>
          <p className="text-xs text-muted-foreground">Revise os dados registrados nesta vistoria.</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 divide-y divide-border/40 space-y-0">
          <SectionTitle icon={<Users className="w-4 h-4" />} label="Responsável" />
          <Row label="Moradores" value={etapa1.moradores_qtd} />
          <Row label="GPS checkin" value={etapa1.checkin_em ? 'Registrado' : 'Não disponível'} />
          {etapa1.gravidas > 0 && <Row label="Grávidas" value={etapa1.gravidas} danger />}
          {etapa1.idosos > 0 && <Row label="Idosos" value={etapa1.idosos} />}
          {etapa1.criancas_7anos > 0 && <Row label="Crianças < 7 anos" value={etapa1.criancas_7anos} />}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 divide-y divide-border/40 space-y-0">
          <SectionTitle icon={<Layers className="w-4 h-4" />} label="Inspeção" />
          <Row label="Depósitos inspecionados" value={totalInspec} />
          <Row label="Com água parada" value={totalAgua} danger={totalAgua > 0} />
          <Row label="Com larva" value={totalFocos} danger={totalFocos > 0} />
          {depositosComFoco.map((d) => (
            <Row
              key={d.tipo}
              label={`  ${d.tipo} — ${DEPOSITO_LABELS[d.tipo]}`}
              value={`${d.qtd_com_focos} foco${d.qtd_com_focos !== 1 ? 's' : ''}`}
              danger
            />
          ))}
        </CardContent>
      </Card>

      {totalFocos > 0 && (
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 divide-y divide-border/40 space-y-0">
            <SectionTitle icon={<FlaskConical className="w-4 h-4" />} label="Tratamento" />
            <Row label="Focos eliminados" value={totalEliminados} />
            {etapa4.tratamentos.filter((t) => t.usou_larvicida).map((t) => (
              <Row key={t.tipo} label={`Larvicida ${t.tipo}`} value={`${t.qtd_larvicida_g}g`} />
            ))}
          </CardContent>
        </Card>
      )}

      {algumSintoma && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Sintomas registrados</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              {etapa2.moradores_sintomas_qtd} morador(es) com sintomas.
              Caso suspeito será gerado automaticamente.
            </p>
          </div>
        </div>
      )}

      {temRisco && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-rose-400/40 bg-rose-50/50 dark:bg-rose-950/20">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Riscos identificados</p>
            <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">
              {riscoAtivo.length} risco(s) marcado(s){outro_risco_vetorial?.trim() ? ' + observação livre' : ''}.
            </p>
          </div>
        </div>
      )}

      {etapa5.observacao?.trim() && (
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
            <p className="text-sm text-foreground">{etapa5.observacao}</p>
          </CardContent>
        </Card>
      )}

      {/* Assinatura digital — captura local; enviada apenas ao clicar em Finalizar */}
      <AssinaturaDigital
        label="Assinatura do responsável (opcional)"
        onCapture={setAssinaturaCapturada}
        onClear={() => setAssinaturaCapturada(undefined)}
      />
      {assinaturaCapturada && (
        <div className="space-y-2">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-1">
            Assinatura pronta para envio ao finalizar a vistoria.
          </p>
          <div className="rounded-xl border border-emerald-300/50 dark:border-emerald-700/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-2">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium mb-1.5 px-0.5">
              Prévia da assinatura
            </p>
            <img
              src={assinaturaCapturada}
              alt="Prévia da assinatura do responsável"
              className="w-full max-h-28 object-contain rounded-md bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-800/60"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12 rounded-xl font-bold"
          onClick={onBack}
          disabled={isSaving}
        >
          Voltar
        </Button>
        <Button
          className="flex-1 h-12 rounded-xl font-bold"
          onClick={() => onConfirm(assinaturaCapturada)}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Finalizar vistoria'}
        </Button>
      </div>
    </div>
  );
}
