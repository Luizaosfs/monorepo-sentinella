import { http } from '@sentinella/api-client';
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
    await http.post('/seed/sla-config', { clienteId, config: DEFAULT_SLA_CONFIG });
  } catch (err) {
    console.error('[seedDefaultSlaConfig] Erro ao criar sla_config padrão:', err);
  }
}
