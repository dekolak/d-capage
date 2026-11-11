import { Module } from '@nestjs/common';
import { GuidesModule } from '../guides/guides.module';
import { AdminCategoriesController, CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({ imports: [GuidesModule], controllers: [CategoriesController, AdminCategoriesController], providers: [CategoriesService] })
export class CategoriesModule {}
