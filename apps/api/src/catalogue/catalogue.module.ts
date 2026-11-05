import { Global, Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';

@Global()
@Module({ controllers: [CatalogueController], providers: [CatalogueService], exports: [CatalogueService] })
export class CatalogueModule {}
