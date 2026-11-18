import { Module } from '@nestjs/common';
import { GuidesModule } from '../guides/guides.module';
import { DiagnosticsService } from './diagnostics.service';
import { SuiviService } from './suivi.service';
import { AdminDiagnosticsController, AdminProceduresController, IaController, ProceduresController } from './procedures.controller';
import { ProceduresService } from './procedures.service';
import { EnvoisService } from './envois.service';
import { UsersModule } from '../users/users.module';

@Module({ imports: [GuidesModule, UsersModule], controllers: [ProceduresController, AdminProceduresController, AdminDiagnosticsController, IaController], providers: [ProceduresService, DiagnosticsService, SuiviService, EnvoisService] })
export class ProceduresModule {}
