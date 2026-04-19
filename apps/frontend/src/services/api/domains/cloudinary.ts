import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { deepToCamel } from '../shared/case-mappers';

export const cloudinary = {
  /** HTTP POST /cloudinary/upload — upload de imagem em base64. */
  uploadImage: async (payload: Parameters<typeof _sb.cloudinary.uploadImage>[0]) => {
    try {
      return await http.post('/cloudinary/upload', deepToCamel(payload));
    } catch { return _sb.cloudinary.uploadImage(payload); }
  },
  /** HTTP DELETE /cloudinary/:publicId — remove imagem do Cloudinary. */
  deleteImage: async (publicId: Parameters<typeof _sb.cloudinary.deleteImage>[0]) => {
    try {
      await http.delete(`/cloudinary/${encodeURIComponent(String(publicId))}`);
    } catch { return _sb.cloudinary.deleteImage(publicId); }
  },
};

// @fallback tabela cloudinary_orfaos — sem endpoint NestJS confirmado
export const cloudinaryOrfaos = {
  listar: _sb.cloudinaryOrfaos.listar.bind(_sb.cloudinaryOrfaos),
};
