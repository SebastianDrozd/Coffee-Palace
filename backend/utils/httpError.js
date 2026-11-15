// An error with an HTTP status and a message the tablet/dashboard can show (in Spanish).
export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const notFound = (what) => new HttpError(404, `No se encontró ${what}.`);
