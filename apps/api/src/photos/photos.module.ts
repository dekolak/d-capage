import { Module } from '@nestjs/common';
import { FichesModule } from '../fiches/fiches.module';
import { PhotosController } from './photos.controller';

@Module({ imports: [FichesModule], controllers: [PhotosController] })
export class PhotosModule {}
