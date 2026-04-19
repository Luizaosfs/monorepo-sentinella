import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { deepToCamel } from '../shared/case-mappers';

export const cloudinary = {
  uploadImage: (payload: Parameters<typeof _sb.cloudinary.uploadImage>[0]) =>
    http.post('/cloudinary/upload', deepToCamel(payload)),

  deleteImage: (publicId: Parameters<typeof _sb.cloudinary.deleteImage>[0]): Promise<void> =>
    http.delete(`/cloudinary/${encodeURIComponent(String(publicId))}`),
};

export const cloudinaryOrfaos = {
  /**
   * @deprecated No-op — nenhuma tela consome cloudinaryOrfaos.listar no frontend atual.
   * Feature de limpeza de infra sem consumidor ativo.
   */
  listar: async (..._args: unknown[]): Promise<Record<string, unknown>[]> => {
    return [];
  },
};
