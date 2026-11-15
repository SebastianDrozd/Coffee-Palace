import { Router } from "express";
import * as orders from "../controllers/ordersController.js";

const router = Router();

router.get("/", orders.list);
router.post("/", orders.create);
router.patch("/:id/status", orders.setStatus);

export default router;
