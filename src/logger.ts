import { Logger } from "homebridge";

export default class PrefixLogger {
  constructor(
    private readonly logger: Logger,
    private readonly prefix: string
  ) {}

  public debug(message: string, ...params: Array<unknown>) {
    this.logger.debug(`[${this.prefix}] ` + message, ...params);
  }

  public info(message: string, ...params: Array<unknown>) {
    this.logger.info(`[${this.prefix}] ` + message, ...params);
  }

  public error(message: string, ...params: Array<unknown>) {
    this.logger.error(`[${this.prefix}] ` + message, ...params);
  }
}
