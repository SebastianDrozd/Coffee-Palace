import { Router } from "express";
import { ah } from "../utils/asyncHandler.js";
import * as orders from "../controllers/ordersController.js";

const router = Router();

router.get("/", ah(orders.list));
router.post("/", ah(orders.create));
router.patch("/:id/status", ah(orders.setStatus));

export default router;
