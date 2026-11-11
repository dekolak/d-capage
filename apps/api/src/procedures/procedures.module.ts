import { Module } from '@nestjs/common';
import { GuidesModule } from '../guides/guides.module';
import { DiagnosticsService } from './diagnostics.service';
import { AdminDiagnosticsController, AdminProceduresController, IaController, ProceduresController } from './procedures.controller';
import { ProceduresService } from './procedures.service';

@Module({ imports: [GuidesModule], controllers: [ProceduresController, AdminProceduresController, AdminDiagnosticsController, IaController], providers: [ProceduresService, DiagnosticsService] })
export class ProceduresModule {}
