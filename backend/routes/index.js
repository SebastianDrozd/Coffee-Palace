import { Router } from "express";
import { pool } from "../configs/db.js";
import categoriesRoutes from "./categoriesRoutes.js";
import exchangeRateRoutes from "./exchangeRateRoutes.js";
import ordersRoutes from "./ordersRoutes.js";
import productsRoutes from "./productsRoutes.js";

const router = Router();

// Quick check that the API and database are up
router.get("/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

router.use("/categories", categoriesRoutes);
router.use("/products", productsRoutes);
router.use("/orders", ordersRoutes);
router.use("/exchange-rate", exchangeRateRoutes);

export default router;
