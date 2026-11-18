import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public, EspaceCourant } from './decorators';
import { ipDe, LIMITE_CONNEXION_IP } from './limiteur';

class ConnexionDto {
  @IsString() @MinLength(1) @MaxLength(120) identifiant!: string;
  @IsString() @MinLength(1) @MaxLength(200) motDePasse!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('connexion')
  @HttpCode(200)
  connexion(@Body() dto: ConnexionDto, @EspaceCourant() espace: string, @Req() req: { ip?: string }) {
    LIMITE_CONNEXION_IP.essai(ipDe(req));
    return this.auth.connexion(dto.identifiant, dto.motDePasse, espace);
  }
}
