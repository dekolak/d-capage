import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MotDePasseController } from './mot-de-passe.controller';
import { MotDePasseService } from './mot-de-passe.service';

@Module({ imports: [AuthModule], controllers: [MotDePasseController], providers: [MotDePasseService] })
export class MotDePasseModule {}
