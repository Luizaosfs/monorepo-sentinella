import 'reflect-metadata';

export const PRISMA_REPOSITORY_METADATA = 'custom:prisma-repository';

export function PrismaRepository(
  token: symbol | Function | any,
): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(
      PRISMA_REPOSITORY_METADATA,
      {
        provide: token,
        useClass: target,
        timestamp: new Date().toISOString(),
      },
      target,
    );
  };
}
