import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { config } from "./configs/config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // Browsers on another address (e.g. the Next.js dev server) may call the API
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

  // The website: tablet at /, dashboard at /dashboard/
  if (fs.existsSync(path.join(config.publicDir, "index.html"))) {
    app.use(
      express.static(config.publicDir, {
        extensions: ["html"],
        setHeaders: (res, filePath) => {
          // Build files have a hash in their name and never change; pages must always be fresh
          if (filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    const notFoundPage = path.join(config.publicDir, "404.html");
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/") && fs.existsSync(notFoundPage)) {
        return res.status(404).sendFile(notFoundPage);
      }
      next();
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
