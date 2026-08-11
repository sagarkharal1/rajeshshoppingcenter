import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ownerLoginLimiter } from "./lib/rate-limits.js";

const app: Express = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// DigitalOcean puts a load balancer in front of this app, so every request
// arrives from the balancer's address. Without this, req.ip is that one
// address for everybody: the rate limiters key all visitors into a single
// bucket, and express-rate-limit refuses to enforce a limit it knows is
// keyed on nonsense — which is why the login limiter and the customer
// lookups were counting requests without ever blocking one.
//
// Trusting exactly one hop is the safe form: the balancer's own entry in
// X-Forwarded-For is believed, anything a client puts there is not.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));

const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Shared across instances, unlike the general throttle below: guessing the
// owner's password is worth counting properly.
app.use("/api/admin/login", ownerLoginLimiter);
app.use("/api/admin", adminApiLimiter);

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "Rajesh Shopping Center API",
    status: "ok",
    message: "Use the web app on http://127.0.0.1:5180 and API routes under /api.",
  });
});

app.use("/api", router);

export default app;
