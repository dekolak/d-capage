import { Module } from '@nestjs/common';
import { AnnoncesController } from './annonces.controller';
import { AnnoncesService } from './annonces.service';

@Module({ controllers: [AnnoncesController], providers: [AnnoncesService] })
export class AnnoncesModule {}
