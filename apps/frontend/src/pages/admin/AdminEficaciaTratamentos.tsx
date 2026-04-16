import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  useEficaciaTratamento,
  LABEL_DEPOSITO, DEPOSITO_ORDEM,
  type EficaciaTratamento,
} from '@/hooks/queries/useEficaciaTratamento';

function EficaciaBadge({ pct }: { pct: number }) {
  const cor =
    pct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' :
    pct >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' :
                'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cor}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 2) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" />~0pp</span>;
  const positivo = delta > 0;
  return (
    <span className={`text-xs font-bold flex items-center gap-0.5 ${positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {positivo ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positivo ? '+' : ''}{delta.toFixed(0)}pp
    </span>
  );
}

function gerarRecomendacoes(dados: EficaciaTratamento[]): string[] {
  const recomendacoes: string[] = [];
  const porDeposito: Record<string, EficaciaTratamento[]> = {};
  for (const d of dados) {
    if (!porDeposito[d.tipo_deposito]) porDeposito[d.tipo_deposito] = [];
    porDeposito[d.tipo_deposito].push(d);
  }

  for (const [tipo, registros] of Object.entries(porDeposito)) {
    const semLarv = registros.find((r) => !r.usou_larvicida);
    const comLarv = registros.find((r) => r.usou_larvicida);
    if (semLarv && comLarv) {
      const delta = comLarv.taxa_eficacia_pct - semLarv.taxa_eficacia_pct;
      if (delta > 15) {
        recomendacoes.push(
          `${LABEL_DEPOSITO[tipo] ?? tipo}: larvicida aumenta eficácia em ${delta.toFixed(0)}pp ` +
          `(${semLarv.taxa_eficacia_pct.toFixed(0)}% → ${comLarv.taxa_eficacia_pct.toFixed(0)}%)`,
        );
      }
    }
    const melhor = comLarv ?? semLarv;
    if (melhor && melhor.taxa_eficacia_pct < 60) {
      recomendacoes.push(
        `${LABEL_DEPOSITO[tipo] ?? tipo}: eficácia abaixo de 60% — revisar protocolo de tratamento`,
      );
    }
  }
  return recomendacoes;
}

export default function AdminEficaciaTratamentos() {
  const { data: dados = [], isLoading } = useEficaciaTratamento();

  const totalFocos = useMemo(
    () => [...new Set(dados.map((d) => d.tipo_deposito + '|' + d.total_casos))].length,
    [dados],
  );

  const porDeposito = useMemo(() => {
    const m: Record<string, { semLarv?: EficaciaTratamento; comLarv?: EficaciaTratamento }> = {};
    for (const d of dados) {
      if (!m[d.tipo_deposito]) m[d.tipo_deposito] = {};
      if (d.usou_larvicida) m[d.tipo_deposito].comLarv = d;
      else m[d.tipo_deposito].semLarv = d;
    }
    return m;
  }, [dados]);

  const ranking = useMemo(() => {
    return DEPOSITO_ORDEM
      .filter((t) => porDeposito[t])
      .map((t) => {
        const { semLarv, comLarv } = porDeposito[t];
        const melhorEficacia = Math.max(
          semLarv?.taxa_eficacia_pct ?? 0,
          comLarv?.taxa_eficacia_pct ?? 0,
        );
        const delta = (comLarv?.taxa_eficacia_pct ?? 0) - (semLarv?.taxa_eficacia_pct ?? 0);
        const totalCasos = (semLarv?.total_casos ?? 0) + (comLarv?.total_casos ?? 0);
        return { tipo: t, semLarv, comLarv, melhorEficacia, delta, totalCasos };
      })
      .sort((a, b) => b.melhorEficacia - a.melhorEficacia);
  }, [porDeposito]);

  const recomendacoes = useMemo(() => gerarRecomendacoes(dados), [dados]);

  // suppress unused variable warning
  void totalFocos;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-foreground">Eficácia de Tratamentos</h1>
        <p className="text-sm text-muted-foreground">
          Baseada nos últimos 6 meses · Focos com recorrência em 90 dias são considerados ineficazes
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : dados.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 flex flex-col items-center gap-3 text-center">
          <Info className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Dados insuficientes</p>
            <p className="text-xs text-muted-foreground">
              São necessários ao menos 5 focos resolvidos por tipo de depósito para calcular a eficácia.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Recomendações */}
          {recomendacoes.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Recomendações automáticas
              </p>
              <ul className="space-y-1">
                {recomendacoes.map((r, i) => (
                  <li key={i} className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Seção 1 — Comparativo Larvicida por depósito */}
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3">
              Larvicida vs. Sem Larvicida — por tipo de depósito
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DEPOSITO_ORDEM.filter((t) => porDeposito[t]).map((tipo) => {
                const { semLarv, comLarv } = porDeposito[tipo];
                const delta = (comLarv?.taxa_eficacia_pct ?? 0) - (semLarv?.taxa_eficacia_pct ?? 0);
                const larvIndicado = delta > 10;
                return (
                  <div key={tipo} className="rounded-xl border border-border/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">{LABEL_DEPOSITO[tipo] ?? tipo}</p>
                      {larvIndicado && comLarv && semLarv && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          Larvicida indicado
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Sem larvicida</p>
                        {semLarv
                          ? <EficaciaBadge pct={semLarv.taxa_eficacia_pct} />
                          : <span className="text-xs text-muted-foreground">—</span>}
                        {semLarv && <p className="text-[10px] text-muted-foreground mt-1">{semLarv.total_casos} casos</p>}
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Com larvicida</p>
                        {comLarv
                          ? <EficaciaBadge pct={comLarv.taxa_eficacia_pct} />
                          : <span className="text-xs text-muted-foreground">—</span>}
                        {comLarv && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {comLarv.total_casos} casos
                            {comLarv.larvicida_medio_g ? ` · ${Math.round(comLarv.larvicida_medio_g ?? 0)}g avg` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {comLarv && semLarv && <div className="flex justify-center"><DeltaBadge delta={delta} /></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção 2 — Ranking */}
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3">
              Ranking por eficácia (melhor resultado por depósito)
            </h2>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Depósito</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Casos</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Sem larvicida</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Com larvicida</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Δ eficácia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ranking.map(({ tipo, semLarv, comLarv, delta, totalCasos }) => (
                    <tr key={tipo} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-xs">{LABEL_DEPOSITO[tipo] ?? tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {totalCasos}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {semLarv ? <EficaciaBadge pct={semLarv.taxa_eficacia_pct} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {comLarv ? <EficaciaBadge pct={comLarv.taxa_eficacia_pct} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {semLarv && comLarv ? <DeltaBadge delta={delta} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aviso dados insuficientes */}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Tipos de depósito com menos de 5 casos não aparecem por insuficiência estatística.
          </p>
        </>
      )}
    </div>
  );
}
