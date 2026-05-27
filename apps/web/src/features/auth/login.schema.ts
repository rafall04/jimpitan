/**
 * Purpose: Login form validation schema for the frontend shell.
 * Caller: LoginForm component.
 * Deps: Zod.
 * MainFuncs: Validates credentials before sending them to the backend auth endpoint.
 * SideEffects: None.
 */
import { z } from 'zod';

export const loginFormSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email, phone, or username.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  rtId: z.string().uuid('Enter a valid RT identifier.').optional().or(z.literal('')),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
