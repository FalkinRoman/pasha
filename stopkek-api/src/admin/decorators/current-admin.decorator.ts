import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AdminUser = { adminId: string; email: string; role: string };

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  }
);
