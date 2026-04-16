import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { LevantamentoItem, LevantamentoItemDetecao } from '@/types/database';

export function getBboxBorderColor(prioridade: string | null | undefined): string {
  const u = (prioridade ?? '').toUpperCase();
  if (u === 'P1') return 'border-red-500 shadow-red-500/50';
  if (u === 'P2') return 'border-orange-400 shadow-orange-400/50';
  if (u === 'P3') return 'border-yellow-400 shadow-yellow-400/50';
  if (u === 'P4' || u === 'P5') return 'border-blue-400 shadow-blue-400/50';

  const p = (prioridade ?? '').toLowerCase();
  if (p === 'crítico' || p === 'critico' || p === 'urgente') return 'border-red-500 shadow-red-500/50';
  if (p === 'alto' || p === 'alta') return 'border-orange-400 shadow-orange-400/50';
  if (p === 'moderado' || p === 'moderada' || p === 'média' || p === 'medio' || p === 'media') {
    return 'border-yellow-400 shadow-yellow-400/50';
  }
  return 'border-blue-400 shadow-blue-400/50';
}

const YoloDetecaoBox = ({
  norm,
  isPrimary,
  label,
  prioridade,
}: {
  norm: number[];
  isPrimary: boolean;
  label?: string;
  prioridade?: string | null;
}) => {
  if (norm.length < 4) return null;
  const [nx1, ny1, nx2, ny2] = norm;
  return (
    <div
      className={cn(
        'absolute pointer-events-none rounded-sm z-[1]',
        isPrimary
          ? cn('border-2 shadow-lg z-[2]', getBboxBorderColor(prioridade ?? null))
          : 'border border-dashed border-white/80',
      )}
      style={{
        left: `${nx1 * 100}%`,
        top: `${ny1 * 100}%`,
        width: `${(nx2 - nx1) * 100}%`,
        height: `${(ny2 - ny1) * 100}%`,
      }}
    >
      {label && (
        <span className="absolute top-0 left-0 translate-y-[-100%] bg-black/65 text-white text-[9px] font-mono px-1 rounded-t-sm leading-tight whitespace-nowrap max-w-[140px] truncate">
          {label}
        </span>
      )}
    </div>
  );
};

function normalizeConf(c: number | null | undefined): number | null {
  if (c == null) return null;
  return c > 1 ? c / 100 : c;
}

/** Detecções que não coincidem com o bbox principal (mesma regra do overlay). */
export function getSecondaryDeteccoes(
  primaryBbox: LevantamentoItem['detection_bbox'],
  detecoes: LevantamentoItemDetecao[],
): LevantamentoItemDetecao[] {
  const primaryNorm = primaryBbox?.bbox_norm;
  return detecoes.filter((d) => {
    const norm = d.bbox_norm as number[] | null;
    if (!norm || norm.length < 4) return false;
    if (
      primaryNorm &&
      primaryNorm.length >= 4 &&
      Math.abs(norm[0] - primaryNorm[0]) < 0.01 &&
      Math.abs(norm[1] - primaryNorm[1]) < 0.01
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Lista compacta abaixo da imagem — evita repetir o mesmo rótulo várias vezes sobre a foto.
 */
export function YoloDetectionsSummary({
  primaryBbox,
  detecoes,
  className,
}: {
  primaryBbox: LevantamentoItem['detection_bbox'];
  detecoes: LevantamentoItemDetecao[];
  className?: string;
}) {
  const secondary = getSecondaryDeteccoes(primaryBbox, detecoes);
  if (!secondary.length) return null;
  const byClass = new Map<string, { confs: number[]; count: number }>();
  for (const d of secondary) {
    const name = (d.class_name ?? 'Desconhecido').trim() || 'Desconhecido';
    const c = normalizeConf(d.confidence);
    if (!byClass.has(name)) byClass.set(name, { confs: [], count: 0 });
    const entry = byClass.get(name)!;
    entry.count += 1;
    if (c != null) entry.confs.push(c);
  }
  const pct = (n: number) => Math.round(n * 100);
  const rows = [...byClass.entries()].map(([name, { confs, count }]) => {
    const range =
      confs.length === 0
        ? '—'
        : confs.length === 1
          ? `${pct(confs[0]!)}%`
          : `${pct(Math.min(...confs))}–${pct(Math.max(...confs))}%`;
    return { name, count, range };
  });
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-muted/40 dark:bg-muted/20 px-3 py-2.5',
        className,
      )}
    >
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Detecções na imagem
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground capitalize">{r.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.count}× · {r.range}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Todas as detecções YOLO sobre a imagem (norm 0–1).
 * Secundárias: tracejado; principal: borda sólida por prioridade.
 * @param showSecondaryLabelsOnImage — se false (padrão), rótulos secundários ficam só no bloco YoloDetectionsSummary.
 */
export function YoloOverlayGroup({
  primaryBbox,
  detecoes,
  prioridade,
  showSecondaryLabelsOnImage = false,
}: {
  primaryBbox: LevantamentoItem['detection_bbox'];
  detecoes: LevantamentoItemDetecao[];
  prioridade: string | null;
  /** @default false — melhor legibilidade; use com YoloDetectionsSummary abaixo da foto. */
  showSecondaryLabelsOnImage?: boolean;
}) {
  const secondary = getSecondaryDeteccoes(primaryBbox, detecoes);
  const primaryNorm = primaryBbox?.bbox_norm;
  return (
    <>
      {secondary.map((d) => {
        const norm = d.bbox_norm as number[] | null;
        if (!norm || norm.length < 4) return null;
        const nc = normalizeConf(d.confidence);
        const label =
          showSecondaryLabelsOnImage && nc != null
            ? `${d.class_name ?? ''} ${Math.round(nc * 100)}%`.trim()
            : undefined;
        return <YoloDetecaoBox key={d.id} norm={norm} isPrimary={false} label={label} />;
      })}
      {primaryNorm && primaryNorm.length >= 4 && (
        <YoloDetecaoBox norm={primaryNorm as number[]} isPrimary prioridade={prioridade} />
      )}
    </>
  );
}

type ImageWithYoloOverlaysProps = {
  src: string;
  alt: string;
  primaryBbox: LevantamentoItem['detection_bbox'] | null | undefined;
  detecoes: LevantamentoItemDetecao[];
  prioridade: string | null;
  className?: string;
  imgClassName?: string;
  /** Miniaturas: só foto, sem caixas YOLO */
  showOverlays?: boolean;
};

/**
 * Imagem com proporção correta para alinhar bbox_norm; usa dimensões do detection_bbox ou onLoad.
 */
export function ImageWithYoloOverlays({
  src,
  alt,
  primaryBbox,
  detecoes,
  prioridade,
  className,
  imgClassName,
  showOverlays = true,
}: ImageWithYoloOverlaysProps) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const bw = primaryBbox?.image_width;
  const bh = primaryBbox?.image_height;
  const aspect = bw && bh ? { w: bw, h: bh } : natural;

  const hasOverlayData =
    showOverlays &&
    ((primaryBbox?.bbox_norm && primaryBbox.bbox_norm.length >= 4) ||
      detecoes.some((d) => d.bbox_norm && (d.bbox_norm as number[]).length >= 4));

  return (
    <div
      className={cn('relative', className)}
      style={aspect ? { aspectRatio: `${aspect.w}/${aspect.h}` } : undefined}
    >
      <img
        src={src}
        alt={alt}
        className={cn('w-full h-full object-contain', imgClassName)}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (!(bw && bh) && el.naturalWidth > 0 && el.naturalHeight > 0) {
            setNatural({ w: el.naturalWidth, h: el.naturalHeight });
          }
        }}
      />
      {hasOverlayData && aspect && (primaryBbox || detecoes.length > 0) && (
        <YoloOverlayGroup primaryBbox={primaryBbox} detecoes={detecoes} prioridade={prioridade} />
      )}
    </div>
  );
}
