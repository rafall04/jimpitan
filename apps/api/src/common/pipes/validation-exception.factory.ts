/**
 * Purpose: Convert class-validator failures into a stable API validation error envelope.
 * Caller: Global ValidationPipe in main.ts.
 * Deps: NestJS BadRequestException and class-validator ValidationError.
 * MainFuncs: Preserves field-level validation details for clients.
 * SideEffects: Creates an exception object consumed by NestJS.
 */
import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    details: errors.map((error) => ({
      field: error.property,
      constraints: error.constraints ?? {},
    })),
  });
}
