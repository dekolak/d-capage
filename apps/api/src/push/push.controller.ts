import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Moi, Principal, Roles, SansConditions } from '../auth/decorators';
import { PushService } from './push.service';

class ClesDto {
  @IsString() @MaxLength(200) p256dh!: string;
  @IsString() @MaxLength(100) auth!: string;
}
class AbonnementDto {
  @IsUrl({ protocols: ['https'], require_tld: false }) @MaxLength(1000) endpoint!: string;
  @ValidateNested() @Type(() => ClesDto) keys!: ClesDto;
}
class DesabonnementDto {
  @IsString() @MaxLength(1000) endpoint!: string;
}

/** Notifications sur le téléphone (admins). */
@Roles(Role.ADMIN)
@SansConditions()
@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  @Get('cle')
  async cle() {
    return { cle: await this.push.clePublique() };
  }

  @Post('abonnement')
  async abonner(@Moi() moi: Principal, @Body() d: AbonnementDto) {
    await this.push.abonner(moi.id, d);
    return { ok: true };
  }

  @Delete('abonnement')
  async desabonner(@Body() d: DesabonnementDto) {
    await this.push.desabonner(d.endpoint);
    return { ok: true };
  }

  /** Notification d'essai sur les téléphones abonnés. */
  @Post('test')
  async test() {
    return { telephones: await this.push.notifierAdmins({ titre: 'Notifications activées ✓', texte: 'Vous recevrez ici les demandes des clients.', url: '/admin' }) };
  }
}
