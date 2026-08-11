import rateLimit from "express-rate-limit";

/**
 * For the two lookups a customer can use without logging in: tracking an order,
 * and opening their own khata.
 *
 * Both take a guessable identifier — order ids count upwards and customer codes
 * run CUST-00001, CUST-00002 — checked against a phone number. One at a time
 * that is a fair way for a customer to reach their own record. Thousands at a
 * time it is a way to walk the whole shop's history, and nothing stopped that.
 *
 * A real customer checking their order needs a handful of attempts. Twenty in
 * fifteen minutes leaves them alone and makes enumeration pointless.
 */
export const customerLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many lookups from this device. Please wait a few minutes and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
