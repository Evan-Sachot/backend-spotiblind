import { Router } from "express";
import spotifyController from "../controllers/spotify.controller.js";

const router = Router();

router.get("/spotify/login", spotifyController.LoginWithSpotify);
router.get("/spotify/callback", spotifyController.callback);

export default router;
