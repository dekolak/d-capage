import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './decorators';

class ConnexionDto {
  @IsString() @MinLength(1) identifiant!: string;
  @IsString() @MinLength(1) motDePasse!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('connexion')
  @HttpCode(200)
  connexion(@Body() dto: ConnexionDto) {
    return this.auth.connexion(dto.identifiant, dto.motDePasse);
  }
}
