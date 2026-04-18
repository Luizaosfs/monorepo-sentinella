import { useState, useRef, useEffect, useCallback } from 'react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useParams, Link } from 'react-router-dom';
import { http, tokenStore } from '@sentinella/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { MapPin, Send, CheckCircle2, Loader2, AlertTriangle, Camera, X, Search, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { extractErrorMessage, uploadDenunciaFoto, type DenunciaResult } from '@/lib/canalCidadaoUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Coords {
  latitude: number;
  longitude: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DenunciaCidadao: React.FC = () => {
  const { slug, bairroId } = useParams<{ slug: string; bairroId: string }>();

  const [descricao, setDescricao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Foto
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [jaExistia, setJaExistia] = useState(false);
  const [fotoFoiPerdida, setFotoFoiPerdida] = useState(false);

  // ── Geolocalização ────────────────────────────────────────────────────────

  const requestGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada neste dispositivo.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    // enableHighAccuracy:false evita em parte o fallback que consulta serviços Google no Chrome (403 em rede restrita/VPN).
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        setGeoError('Localização não disponível. Permita o acesso ao GPS ou digite o endereço abaixo.');
        setGeoLoading(false);
      },
      { timeout: 20000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  };

  // Tenta capturar localização automaticamente ao abrir a página
  useEffect(() => { requestGeolocate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeolocate = requestGeolocate;

  // ── Mapa picker (fallback GPS) ──────────────────────────────────────────────
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCoords({ latitude: lat, longitude: lng });
    setGeoError(null);
    setShowMapPicker(false);
  }, []);

  useEffect(() => {
    if (!showMapPicker || !mapPickerRef.current) return;
    if (mapInstanceRef.current) return; // já inicializado

    // Fix ícone padrão Leaflet com bundlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });

    const map = L.map(mapPickerRef.current, { zoomControl: true }).setView([-15.78, -47.93], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng]).addTo(map);
      handleMapClick(lat, lng);
    });

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [showMapPicker, handleMapClick]);

  // ── Foto ─────────────────────────────────────────────────────────────────

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
  };

  const handleRemoveFoto = () => {
    setFoto(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = '';
  };

  const uploadFoto = async (): Promise<{ url: string; public_id: string } | null> => {
    if (!foto) return null;
    setFotoUploading(true);
    try {
      const token = tokenStore.getAccessToken() ?? undefined;
      return await uploadDenunciaFoto(foto, token);
    } finally {
      setFotoUploading(false);
    }
  };

  // ── Envio ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !bairroId) {
      setSubmitError('Link inválido. Verifique o QR code utilizado.');
      return;
    }
    if (!descricao.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Upload foto antes do RPC
      const fotoResult = await uploadFoto();

      const result = await http.post<DenunciaResult>('/denuncias/cidadao', {
        slug,
        bairroId,
        descricao: endereco.trim()
          ? `${descricao.trim()} — Endereço: ${endereco.trim()}`
          : descricao.trim(),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        fotoUrl: fotoResult?.url ?? null,
        fotoPublicId: fotoResult?.public_id ?? null,
      });

      if (!result.ok) {
        setSubmitError(result.error ?? 'Erro ao registrar denúncia. Tente novamente.');
        return;
      }

      setJaExistia(result.deduplicado === true);
      if (foto && !fotoResult) setFotoFoiPerdida(true);
      setProtocolo(result.foco_id ? result.foco_id.slice(0, 8).toUpperCase() : 'N/A');
    } catch (err: unknown) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sucesso ───────────────────────────────────────────────────────────────

  if (protocolo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {jaExistia ? 'Denúncia já registrada!' : 'Denúncia registrada!'}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {jaExistia
                ? 'Já existe uma denúncia recente para este local. Seu relato foi contabilizado.'
                : 'Obrigado pela sua colaboração. A equipe municipal irá analisar o local informado.'}
            </p>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-5 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Protocolo de atendimento
              </p>
              <p className="text-3xl font-extrabold text-primary tracking-widest">{protocolo}</p>
              <p className="text-xs text-muted-foreground">Guarde este número para acompanhamento</p>
            </CardContent>
          </Card>

          {fotoFoiPerdida && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Sua denúncia foi registrada, mas a foto não pôde ser enviada.</span>
            </div>
          )}

          <Link
            to="/denuncia/consultar"
            className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Search className="w-4 h-4" />
            Acompanhar minha denúncia
          </Link>

          <p className="text-xs text-muted-foreground">
            Seu relato contribui para a saúde da sua cidade.
          </p>
        </div>
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────

  const isSending = submitting || fotoUploading;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="gradient-login-panel px-4 py-5 flex items-center justify-center shadow-lg">
        <Logo className="text-2xl text-white" showIcon={false} />
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 pt-8">
        <div className="w-full max-w-sm space-y-6">

          {/* Title */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Camera className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-foreground leading-tight">
              Encontrou água parada?
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Denuncie aqui. É rápido, anônimo e ajuda a proteger sua família contra a dengue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 1. Foto — primeiro passo, destaque máximo */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">1</span>
                Foto do local
              </p>
              {fotoPreview ? (
                <div className="relative">
                  <img
                    src={fotoPreview}
                    alt="Prévia da foto"
                    className="w-full h-48 object-cover rounded-xl border border-border/60"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveFoto}
                    className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 hover:bg-background transition-colors shadow"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                  <div className="absolute bottom-2 left-2 rounded-full bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Foto adicionada
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-primary hover:border-primary hover:bg-primary/10 transition-colors"
                >
                  <Camera className="w-10 h-10" />
                  <div className="text-center">
                    <p className="text-sm font-bold">Tirar foto agora</p>
                    <p className="text-xs text-muted-foreground mt-0.5">ou escolher da galeria</p>
                  </div>
                </button>
              )}
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handleFotoChange}
              />
            </div>

            {/* 2. Localização */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">2</span>
                Localização
              </p>
              {coords ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                  <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Localização capturada</p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                      {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoords(null)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="w-full h-12 text-sm font-semibold rounded-xl"
                >
                  {geoLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Obtendo localização...</>
                  ) : (
                    <><MapPin className="w-4 h-4 mr-2" /> Usar minha localização</>
                  )}
                </Button>
              )}
              {geoError && (
                <div className="space-y-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {geoError}
                  </p>

                  {/* Mapa para seleção manual */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 rounded-xl h-10"
                    onClick={() => setShowMapPicker((v) => !v)}
                  >
                    <MapIcon className="w-4 h-4" />
                    {showMapPicker ? 'Fechar mapa' : 'Marcar localização no mapa'}
                  </Button>

                  {showMapPicker && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground text-center">Toque no mapa para marcar o local do foco</p>
                      <div ref={mapPickerRef} className="w-full h-52 rounded-xl overflow-hidden border border-border" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="endereco" className="text-xs">Endereço aproximado</Label>
                    <Input
                      id="endereco"
                      placeholder="Ex: Rua das Flores, 123 — próximo à escola"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              )}
              {!geoError && (
                <div className="space-y-1.5">
                  <Label htmlFor="endereco" className="text-xs text-muted-foreground">Endereço aproximado (opcional)</Label>
                  <Input
                    id="endereco"
                    placeholder="Ex: Rua das Flores, 123"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* 3. Descrição */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">3</span>
                O que você viu? <span className="text-destructive ml-1">*</span>
              </p>
              <Textarea
                id="descricao"
                placeholder="Descreva o que encontrou. Ex: piscina abandonada com água parada, lote com entulho acumulando água, caixa d'água sem tampa..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.slice(0, 500))}
                rows={4}
                required
                className="resize-none rounded-xl"
              />
              <p className={cn('text-right text-[10px]', descricao.length >= 450 ? 'text-amber-500' : 'text-muted-foreground')}>
                {descricao.length}/500
              </p>
            </div>

            {/* Erro de envio */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSending || !descricao.trim()}
              className="w-full h-14 text-base font-bold rounded-xl"
            >
              {isSending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {fotoUploading ? 'Enviando foto...' : 'Enviando sua denúncia...'}
                </>
              ) : (
                <><Send className="w-5 h-5 mr-2" /> Enviar denúncia</>
              )}
            </Button>
          </form>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Sua identidade é preservada. As informações serão utilizadas exclusivamente para ações de saúde pública.
            </p>
            <Link
              to="/denuncia/consultar"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Search className="w-3 h-3" /> Consultar protocolo existente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DenunciaCidadao;
