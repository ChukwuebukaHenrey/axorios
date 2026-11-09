import { NonRetriableError } from "inngest";

/** The provider can't pay for sends (Kapso credits). Retrying won't help until the seller tops up. */
export class ChannelPausedError extends NonRetriableError {
  constructor(message: string) {
    super(message);
    this.name = "ChannelPausedError";
  }
}

/** WhatsApp's 24 h window has closed: only a template can be sent. */
export class WindowClosedError extends NonRetriableError {
  constructor(message: string) {
    super(message);
    this.name = "WindowClosedError";
  }
}
