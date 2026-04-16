import { HttpException } from '@nestjs/common';

type Fn = () => Promise<any>;
type ExceptionOrMessage = HttpException | string;
type MaybeStatus = number | undefined;

export async function expectHttpException(
  fn: Fn,
  expected: ExceptionOrMessage,
  expectedStatus?: MaybeStatus,
) {
  try {
    await fn();
    throw new Error('Expected exception was not thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);

    if (expected instanceof HttpException) {
      expect(error.message).toBe(expected.message);
      expect(error.getStatus()).toBe(expected.getStatus());
      return;
    }

    expect(error.message).toBe(expected);
    expect(error.getStatus()).toBe(expectedStatus);
  }
}
