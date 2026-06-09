import { app } from "./app.js";
import dotenv from "dotenv";

import spotifyRoutes from "./routes/spotify.routes.js";
import errorHandler from "./middlewares/errorHandler.js";
import "./config/database.js";

dotenv.config();

const PORT = process.env.PORT;

app.use("/api/auth", spotifyRoutes);
app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
