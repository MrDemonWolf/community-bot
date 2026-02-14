import consola from "consola";
import { env } from "./env.js";

/**
 * Type definitions for logger methods
 */
type LogMetadata = Record<string, unknown>;
type LogError = Error | string | unknown;

interface CommandLogger {
  executing: (command: string, username: string, userId: string) => void;
  success: (command: string, username: string, userId: string) => void;
  error: (
    command: string,
    username: string,
    userId: string,
    error?: LogError
  ) => void;
  warn: (
    command: string,
    username: string,
    userId: string,
    message?: string
  ) => void;
}

interface DatabaseLogger {
  connected: (service: string) => void;
  error: (service: string, error: LogError) => void;
  operation: (operation: string, details?: LogMetadata) => void;
}

interface ApiLogger {
  started: (host: string, port: number) => void;
  error: (error: LogError) => void;
}

interface TwitchLogger {
  authenticated: (username: string) => void;
  authFailed: (attempt: number, reason: string) => void;
  connected: () => void;
  disconnected: (manually: boolean, reason?: string) => void;
  channelJoined: (channel: string, user: string) => void;
  channelJoinFailed: (channel: string, reason: string) => void;
  channelParted: (channel: string, user: string) => void;
  tokenRefreshed: (userId: string) => void;
}

interface Logger {
  success: (component: string, message: string, metadata?: LogMetadata) => void;
  info: (component: string, message: string, metadata?: LogMetadata) => void;
  warn: (component: string, message: string, metadata?: LogMetadata) => void;
  error: (
    component: string,
    message: string,
    error?: LogError,
    metadata?: LogMetadata
  ) => void;
  debug: (component: string, message: string, metadata?: LogMetadata) => void;
  ready: (component: string, message: string, metadata?: LogMetadata) => void;
  commands: CommandLogger;
  database: DatabaseLogger;
  api: ApiLogger;
  twitch: TwitchLogger;
}

/**
 * Centralized logger utility with consistent formatting for the Twitch bot
 * Provides structured logging for different contexts with environment-aware configuration
 */

// Configure consola based on environment
const isDevelopment = env.NODE_ENV === "development";
const isProduction = env.NODE_ENV === "production";

// Set log level based on environment
consola.level = isProduction ? 3 : isDevelopment ? 4 : 3; // Info level in prod, Debug in dev

/**
 * Application logger with consistent formatting
 */
export const logger: Logger = {
  success: (component: string, message: string, metadata?: LogMetadata) => {
    consola.success({
      message: `[${component}] ${message}`,
      ...(metadata && { metadata }),
      badge: true,
    });
  },

  info: (component: string, message: string, metadata?: LogMetadata) => {
    consola.info({
      message: `[${component}] ${message}`,
      ...(metadata && { metadata }),
      badge: true,
    });
  },

  warn: (component: string, message: string, metadata?: LogMetadata) => {
    consola.warn({
      message: `[${component}] ${message}`,
      ...(metadata && { metadata }),
      badge: true,
    });
  },

  error: (
    component: string,
    message: string,
    error?: LogError,
    metadata?: LogMetadata
  ) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    consola.error({
      message: `[${component}] ${message}`,
      ...(errorMessage && { error: errorMessage }),
      ...(errorStack && isDevelopment && { stack: errorStack }),
      ...(metadata && { metadata }),
      badge: true,
    });
  },

  debug: (component: string, message: string, metadata?: LogMetadata) => {
    if (isDevelopment) {
      consola.debug({
        message: `[${component}] ${message}`,
        ...(metadata && { metadata }),
        badge: true,
      });
    }
  },

  ready: (component: string, message: string, metadata?: LogMetadata) => {
    consola.ready({
      message: `[${component}] ${message}`,
      ...(metadata && { metadata }),
      badge: true,
    });
  },

  commands: {
    executing: (command: string, username: string, userId: string) => {
      const logMethod = isProduction ? logger.info : logger.debug;
      logMethod("Twitch - Command", `Executing ${command}`, {
        command,
        user: { username, id: userId },
      });
    },
    success: (command: string, username: string, userId: string) => {
      logger.success("Twitch - Command", `Successfully executed ${command}`, {
        command,
        user: { username, id: userId },
      });
    },
    error: (
      command: string,
      username: string,
      userId: string,
      error?: LogError
    ) => {
      logger.error("Twitch - Command", `Error executing ${command}`, error, {
        command,
        user: { username, id: userId },
      });
    },
    warn: (
      command: string,
      username: string,
      userId: string,
      message?: string
    ) => {
      logger.warn(
        "Twitch - Command",
        message || `Warning executing ${command}`,
        {
          command,
          user: { username, id: userId },
        }
      );
    },
  },

  database: {
    connected: (service: string) =>
      logger.success("Database", `${service} connected`),
    error: (service: string, error: LogError) =>
      logger.error("Database", `${service} connection failed`, error),
    operation: (operation: string, details?: LogMetadata) => {
      const logMethod = isProduction ? logger.info : logger.debug;
      logMethod("Database", operation, details);
    },
  },

  api: {
    started: (host: string, port: number) =>
      logger.ready("API", `Server listening on http://${host}:${port}`),
    error: (error: LogError) => logger.error("API", "Server error", error),
  },

  twitch: {
    authenticated: (username: string) =>
      logger.ready(
        "Twitch",
        `Successfully authenticated as ${username}`
      ),
    authFailed: (attempt: number, reason: string) =>
      logger.error(
        "Twitch",
        `Authentication failed (attempt ${attempt}): ${reason}`
      ),
    connected: () =>
      logger.ready("Twitch", "Connected to Twitch chat"),
    disconnected: (manually: boolean, reason?: string) =>
      logger.warn(
        "Twitch",
        `Disconnected from Twitch chat (manual: ${manually}, reason: ${reason ?? "unknown"})`
      ),
    channelJoined: (channel: string, user: string) =>
      logger.info("Twitch", `${user} joined ${channel}`),
    channelJoinFailed: (channel: string, reason: string) =>
      logger.error("Twitch", `Failed to join ${channel}: ${reason}`),
    channelParted: (channel: string, user: string) =>
      logger.info("Twitch", `${user} left ${channel}`),
    tokenRefreshed: (userId: string) =>
      logger.info("Twitch Auth", `Token refreshed for user ${userId}`),
  },
};

export default logger;
