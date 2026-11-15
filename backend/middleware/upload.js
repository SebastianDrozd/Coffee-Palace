import multer from "multer";
import { config } from "../configs/config.js";

// Keeps the photo in memory so the controller can check it before saving to disk.
// The tablet resizes photos before upload, so they're small.
export const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoBytes, files: 1 },
}).single("image");
