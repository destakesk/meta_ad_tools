import { z } from 'zod';

export const healthStatusSchema = z.enum(['ok', 'degraded', 'down']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const serviceStatusSchema = z.enum(['connected', 'disconnected']);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const healthServicesSchema = z.object({
  database: serviceStatusSchema,
  redis: serviceStatusSchema,
});
export type HealthServices = z.infer<typeof healthServicesSchema>;

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  timestamp: z.string().datetime(),
  uptime: z.number().nonnegative(),
  version: z.string(),
  services: healthServicesSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number().nonnegative(),
});
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;
