import { createParamDecorator } from '@nestjs/common';
import { User } from '@prisma/client';

export const CurrentUser = createParamDecorator((data: never, req: Request): User | null => {
  return req['args'] && req['args'].length > 0 && req['args'][0].user && req['args'][0].user
    ? req['args'][0].user
    : null;
});
