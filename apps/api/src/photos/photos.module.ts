import { Module } from '@nestjs/common';
import { FichesModule } from '../fiches/fiches.module';
import { PhotosController } from './photos.controller';
import { StockageService } from './stockage.service';

@Module({ imports: [FichesModule], controllers: [PhotosController], providers: [StockageService], exports: [StockageService] })
export class PhotosModule {}
