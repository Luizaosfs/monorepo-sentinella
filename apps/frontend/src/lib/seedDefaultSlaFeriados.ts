import { supabase } from '@/lib/supabase';

/**
 * Semeia feriados nacionais brasileiros para um cliente recém-criado.
 * A migration também cria um trigger que faz isso automaticamente no banco —
 * esta função serve como fallback via frontend.
 *
 * Silenciosamente ignora erros para não bloquear o fluxo de criação do cliente.
 */
export async function seedDefaultSlaFeriados(clienteId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('seed_sla_feriados_nacionais', {
      p_cliente_id: clienteId,
    });
    if (error) throw error;
  } catch (err) {
    console.error('[seedDefaultSlaFeriados] Erro ao criar feriados padrão:', err);
  }
}
