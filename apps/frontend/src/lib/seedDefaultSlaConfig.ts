import { supabase } from '@/lib/supabase';
import { DEFAULT_SLA_CONFIG } from '@/types/sla-config';

/**
 * Cria a configuração padrão de SLA (sla_config) para um cliente recém-criado.
 * Usa DEFAULT_SLA_CONFIG de src/types/sla-config.ts — mesmos valores que o TypeScript
 * usa como fallback quando não há config no banco.
 *
 * Silenciosamente ignora erros para não bloquear o fluxo de criação do cliente.
 */
export async function seedDefaultSlaConfig(clienteId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('sla_config')
      .insert({ cliente_id: clienteId, config: DEFAULT_SLA_CONFIG });

    if (error) {
      // Ignora conflito de unicidade (pode já existir via trigger do banco)
      if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
        throw error;
      }
    }

  } catch (err) {
    console.error('[seedDefaultSlaConfig] Erro ao criar sla_config padrão:', err);
  }
}
