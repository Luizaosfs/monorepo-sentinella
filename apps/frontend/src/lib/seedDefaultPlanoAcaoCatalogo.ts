import { http } from '@sentinella/api-client';

/**
 * Popula o catálogo de ações padrão de combate à dengue para um cliente recém-criado.
 * A migration também cria um trigger que faz isso automaticamente no banco —
 * esta função serve como fallback para garantir consistência ao criar via frontend.
 *
 * Silenciosamente ignora erros para não bloquear o fluxo de criação do cliente.
 */
export async function seedDefaultPlanoAcaoCatalogo(clienteId: string): Promise<void> {
  try {
    await http.post('/seed/plano-acao-catalogo', { clienteId });
  } catch (err) {
    console.error('[seedDefaultPlanoAcaoCatalogo] Erro ao criar catálogo de ações padrão:', err);
  }
}
