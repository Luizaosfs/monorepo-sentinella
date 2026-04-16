/**
 * Fonte única de verdade para redirecionamento por perfil (papel).
 *
 * Usar sempre que precisar saber para onde redirecionar após login ou ao
 * acessar "/" sem contexto de rota. As rotas canônicas abaixo têm aliases
 * definidos em App.tsx via <Navigate> — alterando aqui basta.
 */

export const HOME_BY_PAPEL: Record<string, string> = {
  admin:             '/admin/dashboard',
  supervisor:        '/gestor/central',
  agente:            '/agente/hoje',
  operador:          '/agente/hoje', // legado pré-migration 20261015000001 — normalizePapel já converte para 'agente'
  notificador:       '/notificador/registrar',
  analista_regional: '/regional/dashboard',
};

/** Retorna a rota de destino para o papel informado, com fallback para /dashboard. */
export function getHomeByPapel(papel: string | null | undefined): string {
  return HOME_BY_PAPEL[papel ?? ''] ?? '/dashboard';
}
