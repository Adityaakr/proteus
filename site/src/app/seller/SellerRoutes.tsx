/**
 * The seller console now lives on the sell side of the dashboard at /app/sell/* and no longer
 * renders its own shell (the shared AppShell wraps every page). Kept as an alias so existing
 * imports keep working; mount it at /app/sell/*.
 */
import SellRoutes from "../sell/SellRoutes";
import { SELLER_NAV } from "./nav";

export default SellRoutes;
export { SellRoutes as SellerRoutes, SELLER_NAV };
