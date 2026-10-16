import { Outlet } from "react-router-dom";
import { PrivyAppProvider } from "./PrivyAppProvider";

/** Layout route for /login, /app/* and the legacy redirects. Loads Privy only for these routes. */
export default function AuthRoot() {
  return (
    <PrivyAppProvider>
      <Outlet />
    </PrivyAppProvider>
  );
}
