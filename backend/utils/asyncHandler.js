// Express 4 doesn't catch errors thrown by async handlers. This passes them to the error handler.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
