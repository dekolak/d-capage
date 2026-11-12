import { Module } from '@nestjs/common';
import { AdminEntretienController, CarnetController } from './entretien.controller';
import { EntretienService } from './entretien.service';

@Module({ controllers: [CarnetController, AdminEntretienController], providers: [EntretienService] })
export class EntretienModule {}
