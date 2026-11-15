import cors from "cors";
import express from "express";
import { config } from "./configs/config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // Only the Coffee Palace frontend may call this API from a browser
  app.use(
    cors({
      origin: (origin, done) => done(null, !origin || config.corsOrigins.includes(origin)),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    })
  );
  app.use(express.json({ limit: "100kb" }));

  // Product photos: /api/uploads/product-4-1730.webp
  app.use(
    "/api/uploads",
    express.static(config.uploadsDir, {
      immutable: true,
      maxAge: "365d",
      index: false,
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    })
  );

  app.use("/api", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
