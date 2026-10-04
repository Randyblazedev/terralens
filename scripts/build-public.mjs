// Vercel serves the folder named "public". Copy only the website files into it so
// source files (api/, supabase/, scripts/, docs) are never served as static files.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";

rmSync("public", { recursive: true, force: true });
mkdirSync("public");
for (const file of readdirSync(".").filter(name => name.endsWith(".html"))) cpSync(file, `public/${file}`);
cpSync("assets", "public/assets", { recursive: true });
cpSync("src", "public/src", { recursive: true });
console.log("public/ ready");
