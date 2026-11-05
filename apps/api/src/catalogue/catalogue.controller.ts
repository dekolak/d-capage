import { Controller, Get, Param } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';

@Controller('catalogue')
export class CatalogueController {
  constructor(private catalogue: CatalogueService) {}

  /** Fabricants → modèles → variantes (avec la dernière version d'interface). */
  @Get()
  lister() {
    return this.catalogue.lister();
  }

  /** Config miroir complète d'une version. */
  @Get('versions/:id')
  version(@Param('id') id: string) {
    return this.catalogue.version(id);
  }
}
