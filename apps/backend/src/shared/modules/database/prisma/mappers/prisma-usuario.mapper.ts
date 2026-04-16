import { PapelApp, Usuario } from 'src/modules/usuario/entities/usuario';

type RawUsuario = {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string;
  cliente_id: string | null;
  ativo: boolean;
  onboarding_concluido: boolean;
  created_at: Date;
  updated_at: Date;
  papeis_usuarios?: { papel: string }[];
};

export class PrismaUsuarioMapper {
  static toDomain(raw: RawUsuario): Usuario {
    return new Usuario(
      {
        authId: raw.auth_id || undefined,
        nome: raw.nome,
        email: raw.email,
        clienteId: raw.cliente_id || undefined,
        ativo: raw.ativo,
        onboardingConcluido: raw.onboarding_concluido,
        papeis: (raw.papeis_usuarios || []).map((p) => p.papel as PapelApp),
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Usuario) {
    return {
      nome: entity.nome,
      email: entity.email,
      cliente_id: entity.clienteId || null,
      ativo: entity.ativo,
      onboarding_concluido: entity.onboardingConcluido || false,
      updated_at: new Date(),
    };
  }
}
