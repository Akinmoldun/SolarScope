// Vercel serverless entrypoint: exports the Express app for @vercel/node.
// Long-running serving (app.listen) stays in src/index.ts for Replit dev.
import app from "./app.js";

export default app;
