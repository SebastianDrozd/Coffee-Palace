import { Router } from "express";
import { ah } from "../utils/asyncHandler.js";
import * as products from "../controllers/productsController.js";
import { uploadPhoto } from "../middleware/upload.js";

const router = Router();

router.get("/", ah(products.list));
router.post("/", ah(products.create));
router.put("/:id", ah(products.update));
router.delete("/:id", ah(products.remove));
router.post("/:id/image", uploadPhoto, ah(products.uploadImage));
router.delete("/:id/image", ah(products.deleteImage));

export default router;
