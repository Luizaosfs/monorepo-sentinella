import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Usuario } from '../entities/usuario';

export class UsuarioViewModel {
  static toHttp(usuario: Usuario) {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      clienteId: usuario.clienteId,
      ativo: usuario.ativo,
      onboardingConcluido: usuario.onboardingConcluido,
      papeis: usuario.papeis,
      papel: usuario.papeis?.[0] ?? null, // alias — frontend expects single `papel: string`
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
      ...baseAuditToHttp(usuario),
    };
  }
}
