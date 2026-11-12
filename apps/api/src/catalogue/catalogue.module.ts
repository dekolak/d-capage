import { Global, Module } from '@nestjs/common';
import { AdminCatalogueController, CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';

@Global()
@Module({ controllers: [CatalogueController, AdminCatalogueController], providers: [CatalogueService], exports: [CatalogueService] })
export class CatalogueModule {}
