import { Module } from '@nestjs/common';
import { AcademieController, AdminAcademieController } from './academie.controller';
import { AcademieService } from './academie.service';

/** Académie (cours en vidéo, Lazzeko et Kiavik) : module isolé, ses tables, ses routes /academie et /admin/academie. */
@Module({ controllers: [AcademieController, AdminAcademieController], providers: [AcademieService] })
export class AcademieModule {}
