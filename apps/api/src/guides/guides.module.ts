import { Module } from '@nestjs/common';
import { CorrectionsService } from './corrections.service';
import { AdminGuidesController, GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({ controllers: [GuidesController, AdminGuidesController], providers: [GuidesService, CorrectionsService], exports: [GuidesService] })
export class GuidesModule {}
