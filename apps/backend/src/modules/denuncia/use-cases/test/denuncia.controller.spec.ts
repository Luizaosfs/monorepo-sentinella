import { Test } from '@nestjs/testing';
import { DenunciaController } from '../../denuncia.controller';
import { DenunciarCidadao } from '../denunciar-cidadao';
import { ConsultarDenuncia } from '../consultar-denuncia';
import { Reflector } from '@nestjs/core';

describe('DenunciaController', () => {
  let controller: DenunciaController;

  const mockDenunciar = jest.fn().mockResolvedValue({ protocolo: 'abc12345', id: 'foco-id' });
  const mockConsultar = jest.fn().mockResolvedValue({ protocolo: 'abc12345' });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DenunciaController],
      providers: [
        { provide: DenunciarCidadao, useValue: { execute: mockDenunciar } },
        { provide: ConsultarDenuncia, useValue: { execute: mockConsultar } },
        Reflector,
      ],
    }).compile();

    controller = module.get(DenunciaController);
  });

  it('POST /cidadao nao passa authId (endpoint publico)', async () => {
    const body = {
      slug: 'sao-paulo',
      descricao: 'Poco com larvas',
    } as any;
    const result = await controller.denunciar(body);
    expect(result).toEqual({ protocolo: 'abc12345', id: 'foco-id' });
    // authId nao deve ser passado — execute chamado com apenas 1 argumento
    expect(mockDenunciar).toHaveBeenCalledWith(expect.any(Object));
  });

  it('GET /consultar delega ao use-case', async () => {
    const result = await controller.consultar('ABC12345');
    expect(mockConsultar).toHaveBeenCalledWith('abc12345');
    expect(result).toEqual({ protocolo: 'abc12345' });
  });
});
