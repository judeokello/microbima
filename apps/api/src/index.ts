/**
 * MicroBima API - Main Export Index
 * 
 * This file provides centralized exports for all major modules
 * in the MicroBima API application.
 */

// Configuration
// export * from './config'; // Config is internal to the app

// Database
export * from './prisma';

// DTOs (Data Transfer Objects)
export * from './dto';

// Entities (Domain Objects)
export * from './entities';

// Mappers (DTO ↔ Entity conversion)
export * from './mappers';

// Main Application
export { AppModule } from './app.module';
export { AppController } from './app.controller';
export { AppService } from './app.service';
