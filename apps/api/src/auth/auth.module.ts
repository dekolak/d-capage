import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    ApiKeysModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => {
        const secret = c.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET manquant');
        return { secret, signOptions: { expiresIn: c.get('JWT_EXPIRES_IN') ?? '30d' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
