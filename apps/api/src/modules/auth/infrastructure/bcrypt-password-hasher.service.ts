/**
 * Purpose: bcrypt adapter for Auth password and refresh-token hashing.
 * Caller: AuthModule dependency injection for AuthService.
 * Deps: bcrypt and ConfigService.
 * MainFuncs: Hashes secrets and verifies candidate secrets against stored hashes.
 * SideEffects: Performs CPU-bound bcrypt hashing work.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import type { PasswordHasherPort } from './password-hasher.port';

@Injectable()
export class BcryptPasswordHasherService implements PasswordHasherPort {
  constructor(private readonly config: ConfigService) {}

  async hash(value: string): Promise<string> {
    return hash(value, this.config.get<number>('auth.passwordHashRounds', 12));
  }

  async verify(value: string, storedHash: string): Promise<boolean> {
    return compare(value, storedHash);
  }
}
