import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type ExceptionType =
  | 'badRequest'
  | 'notFound'
  | 'forbidden'
  | 'unauthorized'
  | 'conflict'
  | 'internalServerError';

type ExceptionMap = Record<string, { type: ExceptionType; message: string }>;

type ExceptionMethods<T extends ExceptionMap> = {
  [K in keyof T]: () => HttpException;
};

export function createExceptionFactory<T extends ExceptionMap>(
  map: T,
): ExceptionMethods<T> {
  const exceptionFactory = {
    badRequest: (msg: string) => new BadRequestException(msg),
    notFound: (msg: string) => new NotFoundException(msg),
    forbidden: (msg: string) => new ForbiddenException(msg),
    unauthorized: (msg: string) => new UnauthorizedException(msg),
    conflict: (msg: string) => new ConflictException(msg),
    internalServerError: (msg: string) => new InternalServerErrorException(msg),
  };

  const result = {} as ExceptionMethods<T>;

  for (const key in map) {
    const { type, message } = map[key];
    result[key] = () => exceptionFactory[type](message);
  }

  return result;
}
