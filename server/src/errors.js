/** An error whose message is safe to show to the client. `extra` is merged into the JSON body. */
export class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
