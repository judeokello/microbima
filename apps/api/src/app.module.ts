import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigurationModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
