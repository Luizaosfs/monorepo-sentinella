import { PapelApp } from '@/decorators/roles.decorator';

export interface AuthUserShape {
  id: string;
  authId: string;
  email: string;
  nome: string;
  clienteId: string | null;
  agrupamentoId: string | null;
  papeis: PapelApp[];
  isPlatformAdmin: boolean;
}

export function buildAuthUser(
  usuario: {
    id: string;
    auth_id: string | null;
    email: string;
    nome: string;
    cliente_id: string | null;
    agrupamento_id?: string | null;
  },
  papeis: PapelApp[],
): AuthUserShape {
  return {
    id: usuario.id,
    authId: usuario.auth_id!,  // caller must validate non-null before calling
    email: usuario.email,
    nome: usuario.nome,
    clienteId: usuario.cliente_id,
    agrupamentoId: usuario.agrupamento_id ?? null,
    papeis,
    isPlatformAdmin: papeis.includes('admin' as PapelApp),
  };
}
