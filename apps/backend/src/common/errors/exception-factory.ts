import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type ExceptionType =
  | 'badRequest'
  | 'notFound'
  | 'forbidden'
  | 'unauthorized'
  | 'conflict';

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
  };

  const result = {} as ExceptionMethods<T>;

  for (const key in map) {
    const { type, message } = map[key];
    result[key] = () => exceptionFactory[type](message);
  }

  return result;
}
