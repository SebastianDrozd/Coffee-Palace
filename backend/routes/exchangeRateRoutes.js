import { Router } from "express";
import * as exchangeRate from "../controllers/exchangeRateController.js";

const router = Router();

router.get("/", exchangeRate.getStatus);
router.post("/refresh", exchangeRate.refresh);
router.put("/manual", exchangeRate.setManual);
router.delete("/manual", exchangeRate.clearManual);

export default router;
