import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { FichesModule } from './fiches/fiches.module';
import { HealthController } from './health.controller';
import { MachinesModule } from './machines/machines.module';
import { PhotosModule } from './photos/photos.module';
import { ParametresModule } from './parametres/parametres.module';
import { StockageModule } from './stockage/stockage.module';
import { TagsModule } from './tags/tags.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

// En production, l'API sert aussi l'app mobile compilée (un seul service à déployer).
const APP_DIST = process.env.APP_DIST ?? join(__dirname, '../../app/dist');

@Module({
  imports: [
    ...(existsSync(APP_DIST) ? [ServeStaticModule.forRoot({ rootPath: APP_DIST, exclude: ['/api/{*chemin}'] })] : []),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StockageModule,
    ParametresModule,
    AuthModule,
    ApiKeysModule,
    UsersModule,
    CatalogueModule,
    MachinesModule,
    TagsModule,
    WebhooksModule,
    FichesModule,
    PhotosModule,
  ],
  controllers: [HealthController],
  // Toutes les routes sont protégées par défaut (@Public() pour ouvrir).
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
