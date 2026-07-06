import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Shape Passport attaches to the request after JwtStrategy.validate() (see jwt.strategy.ts).
export interface AuthenticatedUser {
  userId: string;
  username: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  return ctx.switchToHttp().getRequest().user;
});
