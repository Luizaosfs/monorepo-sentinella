import { useEffect, useRef, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import L from '@/lib/leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AtribuicaoState, QuarteiraoPolygon, QuarteiraoParaEdicao } from './types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface RegiaoPolygon {
  bairroId: string;
  nome: string;
  geojson: Record<string, unknown>;
}

interface AgenteLegendItem {
  id: string;
  nome: string;
  quadras: number;
  comGeom: number;
}

interface Props {
  /** Mescla no container raiz (ex.: `h-full min-h-0` quando a página define a altura). */
  className?: string;
  regiaoPolygons: RegiaoPolygon[];
  /** Quarteirões com geometria cadastrada — camada operacional principal. */
  quarteiraoPolygons: QuarteiraoPolygon[];
  porRegiao: Map<string, { nome: string; qs: string[] }>;
  atribuicoes: Record<string, AtribuicaoState>;
  selecionadas: Set<string>;
  agentColorMap: Record<string, string>;
  agentesMap: Record<string, string>;
  regiaoNomeMap: Record<string, string>;
  contagemPorQ: Record<string, number>;
  /** pct_cobertura por código de quarteirão (0–100) */
  cobertura?: Record<string, number>;
  /** Itens pré-computados da legenda de agentes */
  agenteLegenda?: AgenteLegendItem[];
  /** Clique simples ou Ctrl/Cmd+clique num polígono de quarteirão. */
  onSelectQuarteirao: (codigo: string, multi: boolean) => void;
  /** Clique num polígono de região — seleciona todos os quarteirões da região. */
  onSelectRegiao: (qs: string[], select: boolean) => void;
  /** Disparado pelo popup "Editar geometria" ao clicar num polígono. */
  onEditarGeometria?: (q: QuarteiraoParaEdicao) => void;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function quarteiraoStyle(
  codigo: string,
  atribuicoes: Record<string, AtribuicaoState>,
  selecionadas: Set<string>,
  agentColorMap: Record<string, string>,
  cobertura?: Record<string, number>,
): L.PathOptions {
  const sel = selecionadas.has(codigo);
  const agenteId = atribuicoes[codigo]?.pendente ?? '';
  const baseColor = agenteId ? (agentColorMap[agenteId] ?? '#6b7280') : '#94a3b8';

  if (sel) {
    return { color: '#1e40af', fillColor: '#3b82f6', weight: 3, fillOpacity: 0.72, opacity: 1, dashArray: undefined };
  }
  if (agenteId) {
    const pct = cobertura?.[codigo];
    const fillOpacity = pct === undefined ? 0.45 : pct >= 80 ? 0.68 : pct >= 30 ? 0.50 : 0.28;
    return { color: baseColor, fillColor: baseColor, weight: 1.8, fillOpacity, opacity: 0.85, dashArray: undefined };
  }
  return { color: '#94a3b8', fillColor: 'transparent', weight: 1.2, fillOpacity: 0, opacity: 0.45, dashArray: '3 4' };
}

const REGIAO_STYLE: L.PathOptions = {
  color: '#64748b',
  fillColor: '#94a3b8',
  weight: 1.5,
  fillOpacity: 0.05,
  dashArray: '5 4',
  opacity: 0.55,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MapaDistribuicao({
  className,
  regiaoPolygons, quarteiraoPolygons, porRegiao,
  atribuicoes, selecionadas, agentColorMap, agentesMap, regiaoNomeMap, contagemPorQ, cobertura,
  agenteLegenda,
  onSelectQuarteirao, onSelectRegiao, onEditarGeometria,
}: Props) {
  const [legendaAberta, setLegendaAberta] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);
  const quarteiraoLayerRef = useRef<L.GeoJSON | null>(null);

  // Mutable refs so event handlers always see fresh state without triggering rebuilds
  const atribuicoesRef = useRef(atribuicoes);
  atribuicoesRef.current = atribuicoes;
  const selecionadasRef = useRef(selecionadas);
  selecionadasRef.current = selecionadas;
  const agentColorMapRef = useRef(agentColorMap);
  agentColorMapRef.current = agentColorMap;
  const agentesMapRef = useRef(agentesMap);
  agentesMapRef.current = agentesMap;
  const regiaoNomeMapRef = useRef(regiaoNomeMap);
  regiaoNomeMapRef.current = regiaoNomeMap;
  const contagemRef = useRef(contagemPorQ);
  contagemRef.current = contagemPorQ;
  const coberturaRef = useRef(cobertura);
  coberturaRef.current = cobertura;
  const porRegiaoRef = useRef(porRegiao);
  porRegiaoRef.current = porRegiao;
  const onSelectQRef = useRef(onSelectQuarteirao);
  onSelectQRef.current = onSelectQuarteirao;
  const onSelectRRef = useRef(onSelectRegiao);
  onSelectRRef.current = onSelectRegiao;
  const onEditarRef = useRef(onEditarGeometria);
  onEditarRef.current = onEditarGeometria;

  // ── GeoJSON feature collections (memoized to avoid rebuild on every render) ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regiaoFeatures = useMemo<any>(() => ({
    type: 'FeatureCollection',
    features: regiaoPolygons.map((r) => ({
      type: 'Feature',
      properties: { bairroId: r.bairroId, nome: r.nome },
      geometry: r.geojson,
    })),
  }), [regiaoPolygons]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quarteiraoFeatures = useMemo<any>(() => ({
    type: 'FeatureCollection',
    features: quarteiraoPolygons.map((q) => ({
      type: 'Feature',
      properties: { id: q.id, codigo: q.codigo, bairroId: q.bairroId },
      geometry: q.geojson,
    })),
  }), [quarteiraoPolygons]);

  // ── Map init (once per mount) ─────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { center: [-15.78, -47.93], zoom: 13 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Layer 2 — Region boundaries (background dashed, not operational) ──────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    regionLayerRef.current?.remove();
    regionLayerRef.current = null;
    if (!regiaoFeatures.features.length) return;

    regionLayerRef.current = L.geoJSON(regiaoFeatures, {
      style: () => REGIAO_STYLE,
      onEachFeature: (f, layer) => {
        const bairroId: string = f.properties?.bairroId ?? '';
        const nome: string = f.properties?.nome ?? '—';

        (layer as L.Path).bindTooltip(`<b style="font-size:12px">${nome}</b>`, { sticky: true });

        layer.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const entry = porRegiaoRef.current.get(bairroId);
          const qs = entry?.qs ?? [];
          const allSel = qs.length > 0 && qs.every((q) => selecionadasRef.current.has(q));
          onSelectRRef.current(qs, !allSel);
        });
      },
    }).addTo(map);

    // Fit only if no quarteirao layer will do it
    if (!quarteiraoPolygons.length) {
      const bounds = regionLayerRef.current.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regiaoFeatures]);

  // ── Layer 3 — Quarteirao polygons (main operational layer) ────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    quarteiraoLayerRef.current?.remove();
    quarteiraoLayerRef.current = null;
    if (!quarteiraoFeatures.features.length) return;

    quarteiraoLayerRef.current = L.geoJSON(quarteiraoFeatures, {
      style: (f) =>
        quarteiraoStyle(
          f?.properties?.codigo ?? '',
          atribuicoesRef.current,
          selecionadasRef.current,
          agentColorMapRef.current,
        ),
      onEachFeature: (f, layer) => {
        const id: string = f.properties?.id ?? '';
        const codigo: string = f.properties?.codigo ?? '';
        const bairroId: string | null = f.properties?.bairroId ?? null;
        // Capture geojson from feature geometry for edit modal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geomGeoJSON: Record<string, unknown> = (f as any).geometry ?? {};

        // Hover tooltip
        (layer as L.Path).bindTooltip(
          () => {
            const agenteId = atribuicoesRef.current[codigo]?.pendente ?? '';
            const nomeAgente = agenteId ? (agentesMapRef.current[agenteId] ?? '?') : 'Sem atribuição';
            const regiaoNome = bairroId ? (regiaoNomeMapRef.current[bairroId] ?? '—') : '—';
            const agentColor = agenteId ? (agentColorMapRef.current[agenteId] ?? '#16a34a') : '#94a3b8';
            const imoveis = contagemRef.current[codigo] ?? 0;
            const pct = coberturaRef.current?.[codigo];
            return `<div style="font-family:system-ui,sans-serif;padding:1px 0;min-width:130px">
              <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:3px">${codigo}</div>
              <div style="font-size:10px;color:#94a3b8;margin-bottom:5px">${regiaoNome}</div>
              <div style="display:flex;align-items:center;gap:5px">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${agentColor};flex-shrink:0"></span>
                <span style="font-size:11px;font-weight:600;color:${agentColor}">${nomeAgente}</span>
              </div>
              ${imoveis > 0 ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px">${imoveis} imóveis</div>` : ''}
              ${pct !== undefined ? `<div style="font-size:10px;color:${pct >= 80 ? '#16a34a' : pct >= 30 ? '#d97706' : '#94a3b8'};margin-top:2px">↗ Cobertura: ${pct}%</div>` : ''}
            </div>`;
          },
          { sticky: true },
        );

        // Hover highlight (weight only — color updated reactively via setStyle)
        layer.on('mouseover', () => {
          (layer as L.Path).setStyle({ weight: 3, opacity: 1 });
        });
        layer.on('mouseout', () => {
          (layer as L.Path).setStyle(
            quarteiraoStyle(codigo, atribuicoesRef.current, selecionadasRef.current, agentColorMapRef.current, coberturaRef.current),
          );
        });

        // Click — select + optional popup with edit button
        layer.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          const multi = e.originalEvent.ctrlKey || e.originalEvent.metaKey;
          onSelectQRef.current(codigo, multi);

          if (!multi && onEditarRef.current) {
            const container = document.createElement('div');
            container.style.cssText = 'min-width:150px;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5';
            const agenteId = atribuicoesRef.current[codigo]?.pendente ?? '';
            const nomeAgente = agenteId ? (agentesMapRef.current[agenteId] ?? '?') : 'Sem atribuição';
            container.innerHTML = `
              <b style="font-size:13px">${codigo}</b><br/>
              <span style="color:#6b7280">${nomeAgente}</span>
            `;
            const btn = document.createElement('button');
            btn.textContent = 'Editar geometria';
            btn.style.cssText = [
              'margin-top:8px;display:block;width:100%;',
              'font-size:11px;padding:4px 8px;cursor:pointer;',
              'border:1px solid #d1d5db;border-radius:4px;background:#f8fafc;',
              'transition:background 0.15s;',
            ].join('');
            btn.onmouseenter = () => { btn.style.background = '#f1f5f9'; };
            btn.onmouseleave = () => { btn.style.background = '#f8fafc'; };

            L.DomEvent.on(btn, 'click', () => {
              map.closePopup();
              onEditarRef.current?.({ id, codigo, bairroId, geojson: geomGeoJSON });
            });
            container.appendChild(btn);

            L.popup({ closeOnClick: true, offset: [0, -4] })
              .setLatLng(e.latlng)
              .setContent(container)
              .openOn(map);
          }
        });
      },
    }).addTo(map);

    const bounds = quarteiraoLayerRef.current.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarteiraoFeatures]);

  // ── Reactive style update — no layer rebuild ──────────────────────────────
  // Uses setStyle() which calls the function per feature, reading fresh ref values.

  useEffect(() => {
    if (!quarteiraoLayerRef.current) return;
    quarteiraoLayerRef.current.setStyle((f) =>
      quarteiraoStyle(
        f?.properties?.codigo ?? '',
        atribuicoes,
        selecionadas,
        agentColorMap,
        cobertura,
      ),
    );
  }, [atribuicoes, selecionadas, agentColorMap, cobertura]);

  // ── UI ────────────────────────────────────────────────────────────────────

  const noData = regiaoPolygons.length === 0 && quarteiraoPolygons.length === 0;
  const semQuarteiraoGeom = !noData && quarteiraoPolygons.length === 0;

  return (
    <div
      className={cn(
        'relative h-full w-full min-h-0 rounded-xl overflow-hidden border',
        className,
      )}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[500] text-[10px] font-medium bg-background/96 backdrop-blur-sm border rounded-lg shadow-md overflow-hidden">
        <div className="px-2.5 py-1 border-b bg-muted/40">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Legenda</span>
        </div>
        <div className="px-2.5 py-1.5 flex flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm shrink-0" style={{ background: '#3b82f6', opacity: 0.85 }} />
            <span className="text-foreground/75">Atribuído</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm border border-dashed border-slate-400 shrink-0" style={{ background: '#f1f5f9' }} />
            <span className="text-foreground/75">Sem agente</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm border-2 border-blue-700 shrink-0" style={{ background: '#3b82f6', opacity: 0.75 }} />
            <span className="text-foreground/75">Selecionado</span>
          </span>
          {cobertura && Object.keys(cobertura).length > 0 && (
            <div className="flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-muted-foreground">
              <span className="shrink-0">Cobertura:</span>
              <span className="flex items-center gap-0.5">
                <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: '#94a3b8', opacity: 0.22 }} />
                <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: '#94a3b8', opacity: 0.52 }} />
                <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: '#94a3b8', opacity: 0.82 }} />
              </span>
              <span>baixa → alta</span>
            </div>
          )}
        </div>
      </div>

      {/* Tip: multi-select + stats HUD */}
      {quarteiraoPolygons.length > 0 && (
        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1.5">
          <div className="text-[10px] bg-background/92 backdrop-blur-sm border rounded-lg px-2.5 py-1 text-muted-foreground shadow-sm">
            + clique para multi-seleção
          </div>
          <div className="flex gap-1.5">
            <span className="text-[10px] bg-background/92 backdrop-blur-sm border rounded-md px-2 py-0.5 text-muted-foreground shadow-sm tabular-nums">
              {quarteiraoPolygons.length} quadras
            </span>
            {selecionadas.size > 0 && (
              <span className="text-[10px] bg-primary text-primary-foreground rounded-md px-2 py-0.5 shadow-sm font-semibold tabular-nums">
                {selecionadas.size} sel.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Agent legend — collapsible, top-right */}
      {agenteLegenda && agenteLegenda.length > 0 && (
        <div className="absolute top-3 right-3 z-[500] bg-background/96 backdrop-blur-sm border rounded-lg shadow-md text-[10px] font-medium min-w-[150px] max-w-[210px]">
          <button
            type="button"
            onClick={() => setLegendaAberta((v) => !v)}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-[10px] font-semibold text-foreground hover:bg-muted/40 rounded-lg transition-colors"
          >
            <span>Agentes ({agenteLegenda.length})</span>
            {legendaAberta
              ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
              : <ChevronRight className="h-3 w-3 text-muted-foreground" />
            }
          </button>
          {legendaAberta && (
            <div className="border-t divide-y divide-border/40 max-h-52 overflow-y-auto rounded-b-lg">
              {agenteLegenda.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: agentColorMap[a.id] ?? '#94a3b8' }}
                  />
                  <span className="truncate flex-1 text-foreground">{a.nome}</span>
                  <span className="text-muted-foreground shrink-0">{a.quadras}q</span>
                  {a.comGeom < a.quadras && (
                    <span className="text-amber-500 shrink-0" title={`${a.quadras - a.comGeom} sem geometria`}>
                      ⚠
                    </span>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-1.5 px-2.5 py-1">
                <span className="h-2.5 w-2.5 rounded border border-slate-400 shrink-0" style={{ background: '#e2e8f0' }} />
                <span className="truncate flex-1 text-muted-foreground">Sem agente</span>
              </div>
            </div>
          )}
        </div>
      )}

      {noData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs text-muted-foreground text-center px-4">
          Nenhum polígono cadastrado. Cadastre geometrias nas regiões e quarteirões para visualizar no mapa.
        </div>
      )}
      {semQuarteiraoGeom && (
        <div className="absolute top-3 right-3 z-[500] text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-2.5 py-1.5 max-w-[200px] text-center">
          Nenhum quarteirão com geometria. Use o botão <b>PenLine</b> na lista lateral para desenhar.
        </div>
      )}

      {/* Re-center / fit button */}
      {(quarteiraoPolygons.length > 0 || regiaoPolygons.length > 0) && (
        <button
          type="button"
          onClick={() => {
            const layer = quarteiraoLayerRef.current ?? regionLayerRef.current;
            const bounds = layer?.getBounds();
            if (bounds?.isValid()) mapRef.current?.fitBounds(bounds, { padding: [20, 20] });
          }}
          className="absolute bottom-8 right-3 z-[500] bg-background/95 backdrop-blur-sm border rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 shadow-sm transition-colors"
          title="Centralizar no território"
        >
          ⊡ Centralizar
        </button>
      )}
    </div>
  );
}
