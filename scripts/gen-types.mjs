import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";

execSync("pnpm --filter @rag-local/api build", { stdio: "inherit" });

const json = execSync("node dist/gen-spec.js", {
  cwd: "apps/api",
  encoding: "utf-8",
  stdio: ["ignore", "pipe", "inherit"],
});

const document = JSON.parse(json);
const ast = await openapiTS(document);

mkdirSync("apps/web/src/types/generated", { recursive: true });
writeFileSync("apps/web/src/types/generated/api.ts", astToString(ast));
console.error("Generated apps/web/src/types/generated/api.ts");
