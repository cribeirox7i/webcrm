// Adaptador serverless do Vercel -- exporta a app Express diretamente (Vercel's Node.js
// runtime aceita uma função (req,res) como handler, e uma app Express já é exatamente isso).
// Ver backend/src/server.ts (o app.listen() ali só roda em dev local, não aqui).
import app from "../src/server";

export default app;
