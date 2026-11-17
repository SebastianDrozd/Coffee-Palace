import { Router } from "express";
import { ah } from "../utils/asyncHandler.js";
import * as categories from "../controllers/categoriesController.js";

const router = Router();

router.get("/", ah(categories.list));
router.post("/", ah(categories.create));
router.put("/reorder", ah(categories.reorder)); // before "/:id"
router.put("/:id", ah(categories.rename));
router.delete("/:id", ah(categories.remove));

export default router;
