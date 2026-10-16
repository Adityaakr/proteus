import { useContext } from "react";
import { AuthContext, type AuthValue } from "./context";

export type { AuthValue, AuthUser, AuthWallet } from "./context";

/**
 * The signed in PROTEUS account. Works under PrivyAppProvider (real or mock mode):
 * { ready, authenticated, user, login, logout, getAccessToken, wallet: { address, type } | null, me, ... }.
 */
export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

export default useAuth;
