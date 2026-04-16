import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import L from '@/lib/leaflet';
import { useMap } from 'react-leaflet';
import { LevantamentoItem } from '@/types/database';
import { PointPopupCard } from './PointPopupCard';

interface MapPopupLayerProps {
  /** When set, popup is open at this item's position */
  item: LevantamentoItem | null;
  onClose: () => void;
  /** Close popup and open the right panel (focus details) */
  onVerDetalhes: () => void;
}

export function MapPopupLayer({
  item,
  onClose,
  onVerDetalhes,
}: MapPopupLayerProps) {
  const map = useMap();
  const popupRef = useRef<L.Popup | null>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const closePopup = () => {
      if (popupRef.current) {
        map.removeLayer(popupRef.current);
        popupRef.current = null;
      }
      if (rootRef.current && containerRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
        containerRef.current = null;
      }
      onClose();
    };

    if (!item || item.latitude == null || item.longitude == null) {
      closePopup();
      return undefined;
    }

    const container = document.createElement('div');
    container.className = 'sentinella-popup-root';
    containerRef.current = container;

    const root = createRoot(container);
    rootRef.current = root;

    root.render(
      <PointPopupCard
        item={item}
        onVerDetalhes={() => {
          onVerDetalhes();
          closePopup();
        }}
      />
    );

    const popup = L.popup({
      closeButton: true,
      autoPan: true,
      className: 'sentinella-leaflet-popup',
    })
      .setLatLng([item.latitude, item.longitude])
      .setContent(container)
      .openOn(map);

    popupRef.current = popup;

    popup.on('remove', () => {
      if (rootRef.current && containerRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
        containerRef.current = null;
      }
      popupRef.current = null;
      onClose();
    });

    const onMapClick = () => {
      closePopup();
      map.off('click', onMapClick);
    };
    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      if (popupRef.current) {
        map.removeLayer(popupRef.current);
        popupRef.current = null;
      }
      if (rootRef.current && containerRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
        containerRef.current = null;
      }
    };
  }, [map, item, onClose, onVerDetalhes]);

  return null;
}
