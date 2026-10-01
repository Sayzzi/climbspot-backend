import { pino, type Logger, type LevelWithSilent } from 'pino';

export type { Logger };

export interface LoggerOptions {
  readonly level: LevelWithSilent;
  /** Human-readable output for local development; JSON otherwise. */
  readonly pretty: boolean;
}

export function createLogger({ level, pretty }: LoggerOptions): Logger {
  return pino({
    level,
    ...(pretty && { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  });
}
