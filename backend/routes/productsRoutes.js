import { Router } from "express";
import * as products from "../controllers/productsController.js";
import { uploadPhoto } from "../middleware/upload.js";

const router = Router();

router.get("/", products.list);
router.post("/", products.create);
router.put("/:id", products.update);
router.delete("/:id", products.remove);
router.post("/:id/image", uploadPhoto, products.uploadImage);
router.delete("/:id/image", products.deleteImage);

export default router;
