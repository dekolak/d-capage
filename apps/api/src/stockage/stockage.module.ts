import { Global, Module } from '@nestjs/common';
import { StockageService } from './stockage.service';

@Global()
@Module({ providers: [StockageService], exports: [StockageService] })
export class StockageModule {}
