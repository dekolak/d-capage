import { Module } from '@nestjs/common';
import { AdminPrecisionsController, TagsController } from './tags.controller';

@Module({ controllers: [TagsController, AdminPrecisionsController] })
export class TagsModule {}
