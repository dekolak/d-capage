import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Moi, ModuleRequis, Principal, Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { GuidesService } from './guides.service';

/** Guides Kiavik (FlexiPRINT, DXonJet…) : chaque guide demande le module `guide-<slug>`. */
@Controller('guides')
export class GuidesController {
  constructor(private guides: GuidesService, private prisma: PrismaService) {}

  /** Guides du compte (selon ses modules). */
  @Get()
  async lister(@Moi() moi: Principal) {
    if (moi.role === Role.ADMIN) return this.guides.lister('tous');
    const modules = await this.prisma.userModule.findMany({ where: { userId: moi.id }, select: { module: true } });
    return this.guides.lister(modules.map((m) => m.module));
  }

  /** Captures du kit (publiques : chargées par des balises <img>, sans jeton). */
  @Public()
  @Get('images/*chemin')
  image(@Param('chemin') chemin: string | string[], @Res() res: Response) {
    const relatif = Array.isArray(chemin) ? chemin.join('/') : chemin;
    const fichier = this.guides.cheminImage(relatif);
    if (!fichier) throw new NotFoundException();
    res.sendFile(fichier, { maxAge: '7d' });
  }

  @ModuleRequis((req) => `guide-${req.params.slug}`)
  @Get(':slug')
  guide(@Param('slug') slug: string, @Moi() moi: Principal) {
    return this.guides.guide(slug, moi.role === Role.ADMIN);
  }
}
