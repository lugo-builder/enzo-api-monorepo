import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class FactoryService {
  constructor(private readonly moduleRef: ModuleRef) {}

  getServiceByClass<T>(serviceClass: Type<T>): T {
    return this.moduleRef.get(serviceClass, { strict: false });
  }
}
