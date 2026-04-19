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
  listar: async () => { throw new Error('[sem endpoint NestJS] cloudinaryOrfaos.listar'); },
};
