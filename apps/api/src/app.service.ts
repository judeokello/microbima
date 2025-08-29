import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'MicroBima API is running!';
  }

  getInternalHealth(): string {
    return 'MicroBima Internal API is running!';
  }

  getPublicHealth(): string {
    return 'MicroBima Public API is running!';
  }
}
