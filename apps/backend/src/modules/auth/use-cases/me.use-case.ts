import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/guards/auth.guard';

@Injectable()
export class MeUseCase {
  execute(user: AuthenticatedUser) {
    return {
      id: user.id,
      authId: user.authId,
      email: user.email,
      nome: user.nome,
      clienteId: user.clienteId,
      agrupamentoId: user.agrupamentoId,
      papeis: user.papeis,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }
}
