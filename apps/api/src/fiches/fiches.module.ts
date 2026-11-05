import { Module } from '@nestjs/common';
import { FichesController } from './fiches.controller';
import { FichesService } from './fiches.service';

@Module({ controllers: [FichesController], providers: [FichesService], exports: [FichesService] })
export class FichesModule {}
