import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ActiviteModule } from './activite/activite.module';
import { AnnoncesModule } from './annonces/annonces.module';
import { MotDePasseModule } from './mot-de-passe/mot-de-passe.module';
import { PushModule } from './push/push.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { EspacesModule } from './espaces/espaces.module';
import { FichesModule } from './fiches/fiches.module';
import { GuidesModule } from './guides/guides.module';
import { ProceduresModule } from './procedures/procedures.module';
import { SolutionsModule } from './solutions/solutions.module';
import { CategoriesModule } from './categories/categories.module';
import { EntretienModule } from './entretien/entretien.module';
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
    ActiviteModule,
    PushModule,
    StockageModule,
    ParametresModule,
    EspacesModule,
    AuthModule,
    ApiKeysModule,
    UsersModule,
    CatalogueModule,
    MachinesModule,
    TagsModule,
    AnnoncesModule,
    WebhooksModule,
    FichesModule,
    PhotosModule,
    GuidesModule,
    ProceduresModule,
    SolutionsModule,
    CategoriesModule,
    EntretienModule,
    MotDePasseModule,
  ],
  controllers: [HealthController],
  // Toutes les routes sont protégées par défaut (@Public() pour ouvrir).
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
