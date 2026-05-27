/**
 * Purpose: Health-check endpoint for API readiness smoke tests.
 * Caller: Load balancers, Docker health checks, and deployment smoke tests.
 * Deps: NestJS controller decorators and PrismaService.
 * MainFuncs: Returns liveness and readiness health responses.
 * SideEffects: Readiness check performs a lightweight database round trip.
 */
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = {
  status: 'ok';
  service: 'jimpitan-api';
  timestamp: string;
  dependencies?: {
    postgres?: 'ok';
  };
};

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: 'API process is reachable.' })
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'jimpitan-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOkResponse({ description: 'API process and database are ready.' })
  async ready(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'jimpitan-api',
        timestamp: new Date().toISOString(),
        dependencies: { postgres: 'ok' },
      };
    } catch {
      throw new ServiceUnavailableException('API dependencies are not ready.');
    }
  }
}
