import { pino, type Bindings, type Logger as PinoLogger } from "pino";

const REDACT_PATHS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "authorization",
  "cookie",
  "apiKey",
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.idToken",
  "*.authorization",
  "*.cookie",
  "*.apiKey",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
];

const isDev = process.env.NODE_ENV !== "production";

export const logger: PinoLogger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: { service: process.env.SERVICE_NAME ?? "community-bot" },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
      }
    : {}),
});

export function child(bindings: Bindings): PinoLogger {
  return logger.child(bindings);
}

export type { PinoLogger as Logger };
