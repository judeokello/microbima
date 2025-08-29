import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): string {
    return this.appService.getHealth();
  }

  @Get('api/internal/health')
  getInternalHealth(): string {
    return this.appService.getInternalHealth();
  }

  @Get('api/v1/health')
  getPublicHealth(): string {
    return this.appService.getPublicHealth();
  }
}
