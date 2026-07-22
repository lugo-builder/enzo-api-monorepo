import { Global, Module } from '@nestjs/common';

import { UserRepoService } from './users/user-repo.service';

@Global()
@Module({
  providers: [UserRepoService],
  exports: [UserRepoService],
  imports: [],
})
export class RepositoryModule {}
