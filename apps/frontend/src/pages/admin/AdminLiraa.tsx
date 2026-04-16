import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Info } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import {
  useLiraa, useLiraaCiclos,
  classificarIIP, COR_IIP, LABEL_IIP,
  type LiraaQuarteirao,
} from '@/hooks/queries/useLiraa';
import { api } from '@/services/api';

/** Radix Select não permite `value=""` em SelectItem — string vazia é reservada ao placeholder. */
const CICLO_TODOS_VALUE = '__all__';

const DEPOSITO_COLS: { key: keyof LiraaQuarteirao; label: string }[] = [
  { key: 'focos_a1', label: 'A1' },
  { key: 'focos_a2', label: 'A2' },
  { key: 'focos_b',  label: 'B'  },
  { key: 'focos_c',  label: 'C'  },
  { key: 'focos_d1', label: 'D1' },
  { key: 'focos_d2', label: 'D2' },
  { key: 'focos_e',  label: 'E'  },
];

export default function AdminLiraa() {
  const { clienteId } = useClienteAtivo();
  const [ciclo, setCiclo] = useState<number | undefined>(undefined);
  const [exportando, setExportando] = useState(false);

  const { data: ciclos = [], isLoading: loadingCiclos } = useLiraaCiclos();
  const { data: dados = [], isLoading: loadingDados } = useLiraa(ciclo);

  // Resumo municipal
  const resumo = useMemo(() => {
    if (!dados.length) return null;
    const totalInsp = dados.reduce((s, q) => s + q.imoveis_inspecionados, 0);
    const totalPos  = dados.reduce((s, q) => s + q.imoveis_positivos, 0);
    const totalFoc  = dados.reduce((s, q) => s + q.total_focos, 0);
    const iipMunicipal = totalInsp > 0 ? (totalPos / totalInsp) * 100 : 0;
    const ibpMunicipal = totalInsp > 0 ? (totalFoc / totalInsp) * 100 : 0;
    const emRisco = dados.filter((q) => q.iip >= 4.0).length;
    return {
      iipMunicipal: Math.round(iipMunicipal * 10) / 10,
      ibpMunicipal: Math.round(ibpMunicipal * 10) / 10,
      emRisco,
      pctRisco: dados.length > 0 ? Math.round((emRisco / dados.length) * 100) : 0,
      totalInsp,
      totalPos,
    };
  }, [dados]);

  async function exportarPdf() {
    if (!clienteId || ciclo === undefined) {
      toast.error('Selecione um ciclo antes de exportar.');
      return;
    }
    setExportando(true);
    try {
      await api.liraa.exportarPdf(clienteId, ciclo);
      toast.success('Relatório gerado com sucesso.');
    } catch {
      toast.error('Erro ao gerar relatório.');
    } finally {
      setExportando(false);
    }
  }

  const isLoading = loadingCiclos || loadingDados;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-foreground">Relatório LIRAa</h1>
          <p className="text-sm text-muted-foreground">
            Levantamento de Índice Rápido para Aedes aegypti — por quarteirão
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={ciclo !== undefined ? String(ciclo) : CICLO_TODOS_VALUE}
            onValueChange={(v) =>
              setCiclo(v === CICLO_TODOS_VALUE ? undefined : Number(v))
            }
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Ciclo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CICLO_TODOS_VALUE}>Todos os ciclos</SelectItem>
              {ciclos.map((c) => (
                <SelectItem key={c} value={String(c)}>Ciclo {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={exportando || ciclo === undefined}
            onClick={exportarPdf}
          >
            <Download className="w-4 h-4 mr-1" />
            {exportando ? 'Gerando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0,1,2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`rounded-xl border p-4 ${COR_IIP[classificarIIP(resumo.iipMunicipal)]}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">IIP Municipal</p>
            <p className="text-3xl font-black mt-1">{resumo.iipMunicipal.toFixed(1)}%</p>
            <p className="text-xs mt-1 font-semibold">
              {LABEL_IIP[classificarIIP(resumo.iipMunicipal)]}
              {' · '}{resumo.totalPos} de {resumo.totalInsp} imóveis
            </p>
          </div>
          <div className="rounded-xl border p-4 bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IBP Municipal</p>
            <p className="text-3xl font-black mt-1">{resumo.ibpMunicipal.toFixed(1)}</p>
            <p className="text-xs mt-1 text-muted-foreground">focos por 100 imóveis inspecionados</p>
          </div>
          <div className={`rounded-xl border p-4 ${resumo.pctRisco > 30 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-muted/30'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Quarteirões em Risco</p>
            <p className="text-3xl font-black mt-1">{resumo.emRisco}</p>
            <p className="text-xs mt-1 font-medium">
              {resumo.pctRisco}% do total · IIP ≥ 4,0%
            </p>
          </div>
        </div>
      ) : null}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-muted-foreground">Satisfatório (IIP &lt; 1%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
          <span className="text-muted-foreground">Alerta (1% – 3,9%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          <span className="text-muted-foreground">Risco (≥ 4%)</span>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : dados.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 flex flex-col items-center gap-3 text-center">
          <Info className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Nenhum dado disponível</p>
            <p className="text-xs text-muted-foreground">
              {ciclo ? `Sem vistorias registradas no ciclo ${ciclo}.` : 'Selecione um ciclo ou verifique se há vistorias registradas.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/60 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Bairro</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Quarteirão</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Insp.</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Positivos</th>
                  <th title="IIP — Índice de Infestação por Imóvel: % de imóveis inspecionados com presença de Aedes aegypti. Satisfatório < 1%, Alerta 1–3,9%, Risco ≥ 4%." className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-help">IIP ⓘ</th>
                  <th title="IBP — Índice de Breteau por Ponto: nº de depósitos positivos por 100 imóveis inspecionados." className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-help">IBP ⓘ</th>
                  {DEPOSITO_COLS.map((c) => (
                    <th key={c.key} className="text-right px-2 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{c.label}</th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Larvicida (g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {dados.map((row, idx) => {
                  const cls = classificarIIP(row.iip);
                  const borderClass = cls === 'risco' ? 'border-l-[3px] border-l-red-500' : cls === 'alerta' ? 'border-l-[3px] border-l-amber-400' : 'border-l-[3px] border-l-emerald-500';
                  return (
                    <tr key={idx} className={`hover:bg-muted/20 transition-colors ${borderClass}`}>
                      <td className="px-4 py-3 font-medium">{row.bairro ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.quarteirao ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.imoveis_inspecionados}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.imoveis_positivos}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${COR_IIP[cls]}`}>
                          {row.iip.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.ibp.toFixed(1)}</td>
                      {DEPOSITO_COLS.map((c) => (
                        <td key={c.key} className={`px-2 py-3 text-right tabular-nums text-xs ${(row[c.key] as number) > 0 ? 'font-bold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                          {row[c.key] as number}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {row.larvicida_total_g > 0 ? row.larvicida_total_g.toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
