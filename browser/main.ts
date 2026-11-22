import { startBrowserService } from "./service";

const token = process.env.BROWSER_TOKEN ?? "";
const port = Number(process.env.PORT ?? 3000);
startBrowserService({ token, port })
  .then((s) => console.log(`[browser] listening on port ${s.port}${process.env.BROWSER_SANDBOX === "off" ? " (Chromium sandbox off)" : ""}`))
  .catch((e) => {
    console.error(`[browser] ${(e as Error).message}`);
    process.exit(1);
  });
