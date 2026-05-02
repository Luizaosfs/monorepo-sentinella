import { useEffect, useRef } from 'react';
import L from '@/lib/leaflet';
import { useMap } from 'react-leaflet';
import type { FocoRiscoAtivo } from '@/types/database';
import { COR_STATUS } from '@/types/focoRisco';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const STATUS_LABEL: Record<string, string> = {
  suspeita:          'Suspeita',
  em_triagem:        'Em triagem',
  aguarda_inspecao:  'Aguarda inspeção',
  em_inspecao:       'Em inspeção',
  confirmado:        'Confirmado',
  em_tratamento:     'Em tratamento',
  resolvido:         'Resolvido',
  descartado:        'Descartado',
};

const SLA_COLOR: Record<string, string> = {
  vencido:  '#E24B4A',
  critico:  '#F97316',
  atencao:  '#EAB308',
  ok:       '#22C55E',
  sem_sla:  '#9CA3AF',
};

const PRIORIDADE_COLOR: Record<string, string> = {
  P1: '#E24B4A',
  P2: '#F97316',
  P3: '#EAB308',
};

function buildPopupHtml(foco: FocoRiscoAtivo): string {
  const endereco = [foco.logradouro, foco.numero].filter(Boolean).join(', ')
    || foco.endereco_normalizado
    || 'Sem endereço';
  const bairro   = foco.bairro ?? '';
  const prioridade = foco.prioridade ?? 'P3';
  const pColor   = PRIORIDADE_COLOR[prioridade] ?? '#9CA3AF';
  const slaColor = SLA_COLOR[foco.sla_status ?? 'sem_sla'];
  const statusLabel = STATUS_LABEL[foco.status] ?? foco.status;
  const data     = foco.suspeita_em
    ? new Date(foco.suspeita_em).toLocaleDateString('pt-BR')
    : '';

  const imgHtml = foco.origem_image_url
    ? `<img src="${foco.origem_image_url}" alt="foto do foco"
         style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />`
    : '';

  const ORIGEM_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
    cidadao: { label: 'Cidadão', bg: '#F3E8FF', color: '#7C3AED', border: '#DDD6FE' },
    drone:   { label: 'Drone',   bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    agente:  { label: 'Agente',  icon: 'agente', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    pluvio:  { label: 'Pluvial', bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' },
    manual:  { label: 'Manual',  bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' },
  };
  const oc = ORIGEM_CFG[foco.origem_tipo ?? ''];
  const origemHtml = oc
    ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:99px;border:1px solid ${oc.border};background:${oc.bg};color:${oc.color};font-size:10px;font-weight:700;">${oc.label}</span>`
    : '';

  return `
<div style="
  min-width:220px;max-width:260px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:13px;line-height:1.4;
">
  ${imgHtml}
  <div style="display:flex;gap:5px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
    <span style="
      background:${pColor};color:#fff;
      font-size:11px;font-weight:700;
      padding:2px 7px;border-radius:99px;
    ">${prioridade}</span>
    <span style="
      background:#F1F5F9;color:#334155;
      font-size:11px;padding:2px 7px;border-radius:99px;
    ">${statusLabel}</span>
    <span style="
      background:${slaColor}22;color:${slaColor};
      font-size:11px;font-weight:600;
      padding:2px 7px;border-radius:99px;
    ">SLA ${foco.sla_status ?? 'sem_sla'}</span>
    ${origemHtml}
  </div>
  ${foco.codigo_foco ? `<div style="font-size:10px;font-family:monospace;color:#9CA3AF;margin-bottom:3px;letter-spacing:0.05em;">${foco.codigo_foco}</div>` : ''}
  <div style="font-weight:600;color:#111827;margin-bottom:2px;">${endereco}</div>
  ${bairro ? `<div style="font-size:11px;color:#6B7280;margin-bottom:4px;">${bairro}</div>` : ''}
  ${data ? `<div style="font-size:11px;color:#9CA3AF;">${data}</div>` : ''}
  <div style="margin-top:10px;padding-top:10px;border-top:1px solid #F1F5F9;display:flex;gap:8px;">
    <span data-acao="detalhes" style="
      flex:1;display:inline-flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:500;color:#374151;cursor:pointer;
      background:#F9FAFB;border:1px solid #E5E7EB;
      padding:7px 0;border-radius:8px;
    ">Ver detalhes</span>
    <span data-acao="vistoria" style="
      flex:1;display:inline-flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:600;color:#fff;cursor:pointer;
      background:#4F46E5;border:1px solid #4338CA;
      padding:7px 0;border-radius:8px;
      box-shadow:0 1px 3px rgba(79,70,229,0.4);
    ">Vistoria</span>
  </div>
</div>`;
}

const PRIORIDADE_SIZE: Record<string, number> = {
  P1: 28,
  P2: 24,
};

function getPinColor(foco: FocoRiscoAtivo): string {
  if (foco.sla_status === 'vencido') return '#E24B4A';
  return COR_STATUS[foco.status] ?? '#888780';
}

function getPinSize(foco: FocoRiscoAtivo): number {
  return PRIORIDADE_SIZE[foco.prioridade ?? ''] ?? 20;
}

function createFocoIcon(foco: FocoRiscoAtivo) {
  const color = getPinColor(foco);
  const size = getPinSize(foco);
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid rgba(255,255,255,0.8);
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Props {
  focos: FocoRiscoAtivo[];
  onFocoClick?: (foco: FocoRiscoAtivo) => void;
  onFocoVistoria?: (foco: FocoRiscoAtivo) => void;
}

export function FocoClusterLayer({ focos, onFocoClick, onFocoVistoria }: Props) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const onFocoClickRef = useRef(onFocoClick);
  onFocoClickRef.current = onFocoClick;
  const onFocoVistoriaRef = useRef(onFocoVistoria);
  onFocoVistoriaRef.current = onFocoVistoria;

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    async function setup() {
      await import('leaflet.markercluster');
      if (cancelled) return;

      if (!groupRef.current) {
        groupRef.current = (L as unknown as { markerClusterGroup: (opts?: object) => L.MarkerClusterGroup }).markerClusterGroup({
          maxClusterRadius: 40,
          showCoverageOnHover: false,
        });
        map.addLayer(groupRef.current);
      }

      const group = groupRef.current;
      group.clearLayers();

      focos.forEach((foco) => {
        if (!foco.latitude || !foco.longitude) return;
        const marker = L.marker([foco.latitude, foco.longitude], {
          icon: createFocoIcon(foco),
        });
        marker.bindPopup(buildPopupHtml(foco), {
          maxWidth: 280,
          className: 'foco-popup',
        });
        marker.on('popupopen', (e) => {
          const container = (e as L.PopupEvent).popup.getElement();
          if (!container) return;
          const btnDetalhes = container.querySelector('[data-acao="detalhes"]') as HTMLElement | null;
          btnDetalhes?.addEventListener('click', () => {
            onFocoClickRef.current?.(foco);
          });
          const btnVistoria = container.querySelector('[data-acao="vistoria"]') as HTMLElement | null;
          btnVistoria?.addEventListener('click', () => {
            onFocoVistoriaRef.current?.(foco);
          });
        });
        group.addLayer(marker);
      });
    }

    setup();

    return () => {
      cancelled = true;
      groupRef.current?.clearLayers();
    };
  }, [map, focos]);

  useEffect(() => {
    return () => {
      if (groupRef.current && map) {
        map.removeLayer(groupRef.current);
        groupRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
