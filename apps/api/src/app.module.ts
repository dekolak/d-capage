import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { FichesModule } from './fiches/fiches.module';
import { HealthController } from './health.controller';
import { MachinesModule } from './machines/machines.module';
import { PhotosModule } from './photos/photos.module';
import { TagsModule } from './tags/tags.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ApiKeysModule,
    UsersModule,
    CatalogueModule,
    MachinesModule,
    TagsModule,
    FichesModule,
    PhotosModule,
  ],
  controllers: [HealthController],
  // Toutes les routes sont protégées par défaut (@Public() pour ouvrir).
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
