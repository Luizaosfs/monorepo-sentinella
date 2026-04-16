import { useState, useRef, useCallback } from 'react';

// Mapeamento de números por extenso em pt-BR para dígitos
const NUMEROS_PT: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3,
  quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100,
};

/**
 * Tenta converter um transcript de voz em número inteiro.
 * Ex: "dois recipientes" → 2, "zero focos" → 0, "cinco" → 5
 */
export function parseNumeroVoz(transcript: string): number | null {
  const lower = transcript.toLowerCase().trim();

  // Tenta número direto primeiro
  const direto = parseInt(lower.replace(/\D/g, ''), 10);
  if (!isNaN(direto) && lower.replace(/\D/g, '') !== '') return direto;

  // Tenta palavras numéricas
  const palavras = lower.split(/\s+/);
  let total = 0;
  let encontrou = false;

  for (const palavra of palavras) {
    if (NUMEROS_PT[palavra] !== undefined) {
      total += NUMEROS_PT[palavra];
      encontrou = true;
    }
  }

  return encontrou ? total : null;
}

const COMANDOS_STOP = ['ok', 'confirmar', 'pronto', 'terminei'];

interface UseVoiceInputReturn {
  isRecording: boolean;
  transcript: string;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceInput(onFinal?: (transcript: string) => void): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;
    setTranscript('');

    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition) as typeof SpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      const combined = (final || interim).trim();
      setTranscript(combined);

      // Parar automaticamente se o usuário disser um comando de stop
      if (final && COMANDOS_STOP.some((cmd) => final.toLowerCase().includes(cmd))) {
        recognition.stop();
        setIsRecording(false);
        onFinal?.(final);
      } else if (final) {
        onFinal?.(final);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isSupported, onFinal]);

  const reset = useCallback(() => {
    setTranscript('');
  }, []);

  return { isRecording, transcript, isSupported, start, stop, reset };
}
