import { Router } from "express";
import * as categories from "../controllers/categoriesController.js";

const router = Router();

router.get("/", categories.list);
router.post("/", categories.create);
router.put("/reorder", categories.reorder); // before "/:id"
router.put("/:id", categories.rename);
router.delete("/:id", categories.remove);

export default router;
