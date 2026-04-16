import { HttpException, HttpStatus } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import type { ZodError } from 'zod';

export const MyZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    throw new HttpException(error.issues[0].message, HttpStatus.BAD_REQUEST);
  },
});
