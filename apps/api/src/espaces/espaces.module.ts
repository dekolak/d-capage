import { Module } from '@nestjs/common';
import { EspacesController } from './espaces.controller';

@Module({ controllers: [EspacesController] })
export class EspacesModule {}
