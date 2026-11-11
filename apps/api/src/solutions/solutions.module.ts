import { Module } from '@nestjs/common';
import { GuidesModule } from '../guides/guides.module';
import { AdminSolutionsController, SolutionsController } from './solutions.controller';
import { SolutionsService } from './solutions.service';

@Module({ imports: [GuidesModule], controllers: [SolutionsController, AdminSolutionsController], providers: [SolutionsService] })
export class SolutionsModule {}
