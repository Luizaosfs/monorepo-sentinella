import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { PlanoAcaoCatalogo } from '@/types/database';

/**
 * Lista ações ativas do catálogo para o operador selecionar ao concluir atendimento.
 * Filtro opcional por tipo_item — inclui sempre as ações genéricas (tipo_item NULL).
 */
export function usePlanoAcaoCatalogo(clienteId: string | null | undefined, tipoItem?: string | null) {
  return useQuery({
    queryKey: ['plano_acao_catalogo', clienteId, tipoItem ?? null],
    queryFn: () => api.planoAcaoCatalogo.listByCliente(clienteId!, tipoItem),
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000, // catálogo muda pouco — 5 min
  });
}

/**
 * Lista todas as ações (inclusive inativas) para a tela de gerenciamento do admin.
 */
export function usePlanoAcaoCatalogoAdmin(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['plano_acao_catalogo_admin', clienteId],
    queryFn: () => api.planoAcaoCatalogo.listAllByCliente(clienteId!),
    enabled: !!clienteId,
  });
}

export function usePlanoAcaoCatalogoMutations(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plano_acao_catalogo', clienteId] });
    queryClient.invalidateQueries({ queryKey: ['plano_acao_catalogo_admin', clienteId] });
  };

  const create = useMutation({
    mutationFn: (payload: Pick<PlanoAcaoCatalogo, 'cliente_id' | 'label' | 'descricao' | 'tipo_item' | 'ordem'>) =>
      api.planoAcaoCatalogo.create(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<Pick<PlanoAcaoCatalogo, 'label' | 'descricao' | 'tipo_item' | 'ativo' | 'ordem'>>) =>
      api.planoAcaoCatalogo.update(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.planoAcaoCatalogo.remove(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
