/**
 * CasosMapaLayer — camada de casos notificados no mapa do gestor.
 *
 * Renderiza casos com coordenada como CircleMarker em cores por doença.
 * Casos sem coordenada (só bairro) são ignorados — sem dado geoespacial confiável.
 * Popup leve: doença + status + distância do foco cruzado (se disponível).
 */
import { CircleMarker, Popup } from 'react-leaflet';
import type { CasoNotificado } from '@/types/database';

// ── Cores por doença ──────────────────────────────────────────────────────────

const COR_DOENCA: Record<string, string> = {
  dengue:        '#7c3aed', // violeta
  chikungunya:   '#c026d3', // fúcsia
  zika:          '#4f46e5', // índigo
  suspeito:      '#6b7280', // cinza
};

const LABEL_DOENCA: Record<string, string> = {
  dengue:      'Dengue',
  chikungunya: 'Chikungunya',
  zika:        'Zika',
  suspeito:    'Suspeito',
};

const LABEL_STATUS: Record<string, string> = {
  suspeito:   'Suspeito',
  confirmado: 'Confirmado',
  descartado: 'Descartado',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface CasosMapaLayerProps {
  casos: CasoNotificado[];
  /** Destaca casos cujo bairro ou coordenada está perto de focos com cruzamento ativo. */
  comCruzamento?: Set<string>; // conjunto de caso_ids com cruzamento
}

// ── Componente ────────────────────────────────────────────────────────────────

export function CasosMapaLayer({ casos, comCruzamento }: CasosMapaLayerProps) {
  const comCoordenada = casos.filter(
    (c) => c.latitude != null && c.longitude != null && c.status !== 'descartado',
  );

  if (comCoordenada.length === 0) return null;

  return (
    <>
      {comCoordenada.map((c) => {
        const cor = COR_DOENCA[c.doenca] ?? '#6b7280';
        const temCruz = comCruzamento?.has(c.id) ?? false;

        return (
          <CircleMarker
            key={c.id}
            center={[c.latitude!, c.longitude!]}
            radius={temCruz ? 11 : 8}
            pathOptions={{
              color: temCruz ? '#dc2626' : cor,
              fillColor: cor,
              fillOpacity: temCruz ? 0.75 : 0.5,
              weight: temCruz ? 3 : 1.5,
              dashArray: temCruz ? undefined : '4 2',
            }}
          >
            <Popup maxWidth={200}>
              <div className="text-xs space-y-0.5 min-w-[140px]">
                <p className="font-bold text-sm">{LABEL_DOENCA[c.doenca] ?? c.doenca}</p>
                <p className="text-muted-foreground">
                  Status: <span className="font-medium text-foreground">{LABEL_STATUS[c.status] ?? c.status}</span>
                </p>
                {c.bairro && (
                  <p className="text-muted-foreground">Bairro: {c.bairro}</p>
                )}
                {temCruz && (
                  <p className="font-semibold text-red-600 pt-1">⚠ Foco de risco cruzado</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
