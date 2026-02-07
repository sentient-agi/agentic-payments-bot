// Multi-Target Logger
//
import winston from "winston";
import { AppConfig } from "../config/loader";

let _logger: winston.Logger | null = null;

export function initLogger(config: AppConfig): winston.Logger {
  const transports: winston.transport[] = [];

  if (config.logging.stdout) {
    transports.push(
      new winston.transports.Console({
        level: config.logging.level,
        stderrLevels: config.logging.stderr_errors ? ["error", "warn"] : [],
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(
            ({ timestamp, level, message, ...meta }) =>
              `${timestamp} [${level}] ${message}${
                Object.keys(meta).length ? " " + JSON.stringify(meta) : ""
              }`
          )
        ),
      })
    );
  }

  if (config.logging.file.enabled) {
    transports.push(
      new winston.transports.File({
        filename: config.logging.file.path,
        level: config.logging.level,
        maxsize: config.logging.file.max_size_mb * 1024 * 1024,
        maxFiles: config.logging.file.max_files,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }

  _logger = winston.createLogger({
    level: config.logging.level,
    transports,
    defaultMeta: { skill: config.skill.name, version: config.skill.version },
  });

  return _logger;
}

export function getLogger(): winston.Logger {
  if (!_logger) {
    throw new Error("Logger not initialized. Call initLogger() first.");
  }
  return _logger;
}
