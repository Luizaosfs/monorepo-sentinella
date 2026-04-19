import { http } from '@sentinella/api-client';
import { logFallback } from '@/lib/fallbackLogger';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const usuarios = {
  /**
   * Lista papéis dos usuários de um cliente via REST.
   * Backend retorna { usuario_id, papel }[] diretamente (sem ViewModel).
   */
  listPapeis: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.usuarios.listPapeis>> => {
    try { return await http.get(`/usuarios/papeis${qs({ clienteId })}`); }
    catch { return _sb.usuarios.listPapeis(clienteId); }
  },

  /**
   * Lista usuários de um cliente via REST.
   */
  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.usuarios.listByCliente>> => {
    try {
      const raw = await http.get(`/usuarios${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.usuarios.listByCliente>;
    } catch { return _sb.usuarios.listByCliente(clienteId); }
  },

  /**
   * Lista todos os usuários (admin) via REST.
   */
  listAll: async (): Promise<Ret<typeof _sb.usuarios.listAll>> => {
    try {
      const raw = await http.get('/usuarios');
      return deepToSnake(raw) as Ret<typeof _sb.usuarios.listAll>;
    } catch { return _sb.usuarios.listAll(); }
  },

  /** Lista agentes/operadores do cliente. */
  listAgentes: async (clienteId: string): Promise<Ret<typeof _sb.usuarios.listAgentes>> => {
    try {
      const raw = await http.get(`/usuarios${qs({ clienteId, papel: 'agente' })}`);
      return deepToSnake(raw) as Ret<typeof _sb.usuarios.listAgentes>;
    } catch (err) {
      logFallback('usuarios', 'listAgentes', err, '/usuarios?papel=agente');
      return _sb.usuarios.listAgentes(clienteId);
    }
  },

  /** Lista todos os papéis da plataforma — exclusivo para admin (sem filtro de cliente). */
  listAllPapeis: async (): Promise<Ret<typeof _sb.usuarios.listAllPapeis>> => {
    try {
      return await http.get('/usuarios/papeis');
    } catch (err) {
      logFallback('usuarios', 'listAllPapeis', err, '/usuarios/papeis');
      return _sb.usuarios.listAllPapeis();
    }
  },

  /** Verifica se email já existe. */
  checkEmailExists: async (email: string): Promise<boolean> => {
    try {
      const raw = await http.get(`/usuarios${qs({ email })}`) as unknown[];
      return Array.isArray(raw) ? raw.length > 0 : false;
    } catch {
      return _sb.usuarios.checkEmailExists(email);
    }
  },

  /** Cria usuário (alias de create). */
  insert: async (payload: Parameters<typeof _sb.usuarios.insert>[0]): Promise<Ret<typeof _sb.usuarios.insert>> => {
    try {
      return deepToSnake(await http.post('/usuarios', payload)) as Ret<typeof _sb.usuarios.insert>;
    } catch (err) {
      logFallback('usuarios', 'insert', err, 'POST /usuarios');
      return _sb.usuarios.insert(payload);
    }
  },

  /** Atualiza campos do usuário. */
  update: async (id: string, payload: Parameters<typeof _sb.usuarios.update>[1]): Promise<Ret<typeof _sb.usuarios.update>> => {
    try {
      return deepToSnake(await http.patch(`/usuarios/${id}`, payload)) as Ret<typeof _sb.usuarios.update>;
    } catch (err) {
      logFallback('usuarios', 'update', err, `PATCH /usuarios/${id}`);
      return _sb.usuarios.update(id, payload);
    }
  },

  /** Atualiza papel do usuário. */
  updatePapel: async (id: string, papel: string): Promise<void> => {
    try {
      await http.patch(`/usuarios/${id}`, { papeis: [papel] });
    } catch (err) {
      logFallback('usuarios', 'updatePapel', err, `PATCH /usuarios/${id}`);
      return _sb.usuarios.updatePapel(id, papel);
    }
  },

  /** Define papel do usuário (alias de updatePapel). */
  setPapel: async (id: string, papel: string): Promise<void> => {
    try {
      await http.patch(`/usuarios/${id}`, { papeis: [papel] });
    } catch (err) {
      logFallback('usuarios', 'setPapel', err, `PATCH /usuarios/${id}`);
      return _sb.usuarios.setPapel(id, papel);
    }
  },

  /** Remove todos os papéis do usuário. */
  deletePapeis: async (id: string): Promise<void> => {
    try {
      await http.patch(`/usuarios/${id}`, { papeis: [] });
    } catch (err) {
      logFallback('usuarios', 'deletePapeis', err, `PATCH /usuarios/${id}`);
      return _sb.usuarios.deletePapeis(id);
    }
  },

  /** Desativa usuário (soft delete). */
  remove: async (id: string): Promise<void> => {
    try {
      await http.delete(`/usuarios/${id}`);
    } catch (err) {
      logFallback('usuarios', 'remove', err, `DELETE /usuarios/${id}`);
      return _sb.usuarios.remove(id);
    }
  },

  /** Marca onboarding como concluído. */
  marcarOnboardingConcluido: async (id: string): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await http.patch(`/usuarios/${id}`, { onboardingConcluido: true } as any);
    } catch (err) {
      logFallback('usuarios', 'marcarOnboardingConcluido', err, `PATCH /usuarios/${id}`);
      return _sb.usuarios.marcarOnboardingConcluido(id);
    }
  },
};
