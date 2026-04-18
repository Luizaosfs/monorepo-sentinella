import { http } from '@sentinella/api-client';

/**
 * Semeia feriados nacionais brasileiros para um cliente recém-criado.
 * A migration também cria um trigger que faz isso automaticamente no banco —
 * esta função serve como fallback via frontend.
 *
 * Silenciosamente ignora erros para não bloquear o fluxo de criação do cliente.
 */
export async function seedDefaultSlaFeriados(clienteId: string): Promise<void> {
  try {
    await http.post('/seed/sla-feriados', { clienteId });
  } catch (err) {
    console.error('[seedDefaultSlaFeriados] Erro ao criar feriados padrão:', err);
  }
}
