import { Test } from '@nestjs/testing';
import { REQUEST, Reflector } from '@nestjs/core';
import { DenunciaController } from '../../denuncia.controller';
import { ConsultarDenuncia } from '../consultar-denuncia';
import { DenunciarCidadaoV2 } from '../denunciar-cidadao-v2';
import { CanalCidadaoStats } from '../canal-cidadao-stats';
import { UploadFotoDenuncia } from '../upload-foto-denuncia';
import { mockRequest } from '@test/utils/user-helpers';

describe('DenunciaController', () => {
  let controller: DenunciaController;

  const mockDenunciarV2 = jest.fn().mockResolvedValue({ protocolo: 'abc12345', id: 'foco-id' });
  const mockConsultar = jest.fn().mockResolvedValue({ protocolo: 'abc12345' });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DenunciaController],
      providers: [
        { provide: DenunciarCidadaoV2, useValue: { execute: mockDenunciarV2 } },
        { provide: ConsultarDenuncia, useValue: { execute: mockConsultar } },
        { provide: CanalCidadaoStats, useValue: { execute: jest.fn() } },
        { provide: UploadFotoDenuncia, useValue: { execute: jest.fn() } },
        { provide: REQUEST, useValue: mockRequest() },
        Reflector,
      ],
    }).compile();

    controller = module.get(DenunciaController);
  });

  it('POST /cidadao delega ao V2 com ipHash', async () => {
    const body = {
      slug: 'sao-paulo',
      descricao: 'Poco com larvas',
    } as any;
    jest.clearAllMocks();
    mockDenunciarV2.mockResolvedValue({ protocolo: 'abc12345', id: 'foco-id' });
    const result = await controller.denunciar(body, { ip: '1.2.3.4' } as any);
    expect(result).toEqual({ protocolo: 'abc12345', id: 'foco-id' });
    expect(mockDenunciarV2).toHaveBeenCalledWith(expect.any(Object), expect.any(String));
  });

  it('GET /consultar delega ao use-case', async () => {
    const result = await controller.consultar('ABC12345');
    expect(mockConsultar).toHaveBeenCalledWith('abc12345');
    expect(result).toEqual({ protocolo: 'abc12345' });
  });
});
