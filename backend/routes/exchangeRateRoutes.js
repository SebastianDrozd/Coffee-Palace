import { Router } from "express";
import { ah } from "../utils/asyncHandler.js";
import * as exchangeRate from "../controllers/exchangeRateController.js";

const router = Router();

router.get("/", ah(exchangeRate.getStatus));
router.post("/refresh", ah(exchangeRate.refresh));
router.put("/manual", ah(exchangeRate.setManual));
router.delete("/manual", ah(exchangeRate.clearManual));

export default router;
