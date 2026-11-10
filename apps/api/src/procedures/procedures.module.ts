import { Module } from '@nestjs/common';
import { GuidesModule } from '../guides/guides.module';
import { AdminProceduresController, ProceduresController } from './procedures.controller';
import { ProceduresService } from './procedures.service';

@Module({ imports: [GuidesModule], controllers: [ProceduresController, AdminProceduresController], providers: [ProceduresService] })
export class ProceduresModule {}
