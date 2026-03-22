import consola from "consola";

/**
 * Type definitions for logger methods
 */
export type LogMetadata = Record<string, unknown>;
export type LogError = Error | string | unknown;

export interface CommandLogger {
  executing: (...args: unknown[]) => void;
  success: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  [key: string]: (...args: unknown[]) => void;
}

export interface DatabaseLogger {
  connected: (service: string) => void;
  error: (service: string, error: LogError) => void;
  operation: (operation: string, details?: LogMetadata) => void;
}

export interface ApiLogger {
  started: (host: string, port: number) => void;
  error: (error: LogError) => void;
  request?: (method: string, path: string, status: number) => void;
}

export interface BaseLogger {
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
}

/**
 * Creates a platform-specific logger with shared base functionality.
 *
 * @param platform - The platform name (e.g. "discord", "twitch")
 * @param nodeEnv - The NODE_ENV value for configuring log levels
 * @param commandPrefix - The prefix for command log messages (e.g. "Discord - Command", "Twitch - Command")
 * @param platformMethods - Factory function that receives the base logger and returns platform-specific methods
 * @param options - Optional overrides for base sub-loggers (commands, api)
 */
export function createLogger<T extends Record<string, (...args: any[]) => void>>(
  platform: string,
  nodeEnv: string,
  commandPrefix: string,
  platformMethods: (baseLogger: BaseLogger) => T,
  options?: {
    commands?: {
      unauthorized?: (...args: any[]) => void;
    };
    api?: {
      request?: (method: string, path: string, status: number) => void;
    };
    unauthorized?: (
      operation: string,
      username: string,
      userId: string,
      extra?: string
    ) => void;
  }
): BaseLogger & { [K in typeof platform]: T } & Record<string, unknown> {
  const isDevelopment = nodeEnv === "development";
  const isProduction = nodeEnv === "production";

  // Set log level based on environment
  consola.level = isProduction ? 3 : isDevelopment ? 4 : 3;

  // We need to define the logger object first and then assign self-referencing methods
  const logger: any = {
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
  };

  // Commands sub-logger
  logger.commands = {
    executing: (
      command: string,
      username: string,
      id: string,
      extra?: string
    ) => {
      const logMethod = isProduction ? logger.info : logger.debug;
      logMethod(commandPrefix, `Executing ${command}`, {
        command,
        user: { username, id },
        ...(extra && { guild: extra }),
      });
    },
    success: (
      command: string,
      username: string,
      id: string,
      extra?: string
    ) => {
      logger.success(commandPrefix, `Successfully executed ${command}`, {
        command,
        user: { username, id },
        ...(extra && { guild: extra }),
      });
    },
    error: (
      command: string,
      username: string,
      id: string,
      error?: LogError,
      extra?: string
    ) => {
      logger.error(commandPrefix, `Error executing ${command}`, error, {
        command,
        user: { username, id },
        ...(extra && { guild: extra }),
      });
    },
    warn: (
      command: string,
      username: string,
      id: string,
      message?: string,
      extra?: string
    ) => {
      logger.warn(
        commandPrefix,
        message || `Warning executing ${command}`,
        {
          command,
          user: { username, id },
          ...(extra && { guild: extra }),
        }
      );
    },
    ...(options?.commands?.unauthorized && {
      unauthorized: options.commands.unauthorized,
    }),
  };

  // Database sub-logger
  logger.database = {
    connected: (service: string) =>
      logger.success("Database", `${service} connected`),
    error: (service: string, error: LogError) =>
      logger.error("Database", `${service} connection failed`, error),
    operation: (operation: string, details?: LogMetadata) => {
      const logMethod = isProduction ? logger.info : logger.debug;
      logMethod("Database", operation, details);
    },
  };

  // API sub-logger
  logger.api = {
    started: (host: string, port: number) =>
      logger.ready("API", `Server listening on http://${host}:${port}`),
    error: (error: LogError) => logger.error("API", "Server error", error),
    ...(options?.api?.request && { request: options.api.request }),
  };

  // Add unauthorized if provided
  if (options?.unauthorized) {
    logger.unauthorized = options.unauthorized;
  }

  // Add platform-specific sub-logger
  const platformSubLogger = platformMethods(logger as BaseLogger);
  logger[platform] = platformSubLogger;

  return logger;
}
