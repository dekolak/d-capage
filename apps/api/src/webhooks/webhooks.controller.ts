import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../auth/decorators';
import { EVENEMENTS, WebhooksService } from './webhooks.service';

class CreerWebhookDto {
  @IsString() @MinLength(1) @MaxLength(80) nom!: string;
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] }) url!: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(EVENEMENTS as unknown as string[], { each: true }) evenements?: string[];
}

class ModifierWebhookDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) nom?: string;
  @IsOptional() @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] }) url?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(EVENEMENTS as unknown as string[], { each: true }) evenements?: string[];
  @IsOptional() @IsBoolean() actif?: boolean;
}

/** Abonnements aux publications (fiches, avis) — admin uniquement. */
@Controller('admin/webhooks')
@Roles(Role.ADMIN)
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Get('evenements')
  evenements() {
    return EVENEMENTS;
  }

  @Get()
  lister() {
    return this.webhooks.lister();
  }

  @Post()
  creer(@Body() dto: CreerWebhookDto) {
    return this.webhooks.creer(dto);
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() dto: ModifierWebhookDto) {
    return this.webhooks.modifier(id, dto);
  }

  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.webhooks.supprimer(id);
  }

  @Post(':id/test')
  tester(@Param('id') id: string) {
    return this.webhooks.tester(id);
  }

  @Get(':id/livraisons')
  livraisons(@Param('id') id: string) {
    return this.webhooks.livraisons(id);
  }
}
