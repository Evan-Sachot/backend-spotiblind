import { Router } from "express";
import spotifyController from "../controllers/spotify.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/spotify/login", spotifyController.LoginWithSpotify);
router.get("/spotify/callback", spotifyController.callback);
router.put("/spotify/username", verifyToken, spotifyController.updateUsername);

export default router;
