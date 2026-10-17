import { Suspense, lazy, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { KeyValue, MonoValue } from "../ui/misc";
import { LoadingCard } from "../ui/Skeleton";
import { useAuth } from "../auth/useAuth";
import { ARC_NETWORK_NAMES, defaultNetwork } from "@proteus/domain";
import { PageHeader } from "../buyer/common";
import h from "./home.module.css";

// The seller signer section is owned by the sell module. Loaded only when the account has an org.
const signerModules = import.meta.glob<Record<string, unknown>>("../sell/SignerSection.tsx");
const signerLoader = signerModules["../sell/SignerSection.tsx"];
const SignerSection = signerLoader
  ? lazy(async (): Promise<{ default: ComponentType }> => {
      const m = await signerLoader();
      const C = (m.default ?? m.SignerSection) as ComponentType | undefined;
      return { default: C ?? (() => null) };
    })
  : null;

const METHOD_LABEL: Record<string, string> = { email: "Email", google: "Google", wallet: "External wallet" };

export default function Settings() {
  const { user, wallet, me, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <AppShell title="Settings">
      <PageHeader title="Settings" />
      <div className={h.grid}>
        <div className={h.stack}>
          <Card title="Profile">
            <KeyValue
              items={[
                { k: "Email", v: user?.email ?? "Not linked" },
                { k: "Sign in with", v: user?.loginMethods.length ? user.loginMethods.map((m) => METHOD_LABEL[m] ?? m).join(", ") : "Email" },
                { k: "Account id", v: user ? <MonoValue value={user.id} short copy label="account id" /> : "" },
                ...(me?.org ? [{ k: "Seller org", v: `${me.org.name} (${me.org.slug})` }] : []),
              ]}
            />
          </Card>
          <Card title="Wallet">
            <KeyValue
              items={[
                { k: "Address", v: wallet ? <MonoValue value={wallet.address} short copy label="wallet address" /> : "Being created" },
                { k: "Type", v: wallet?.type === "external" ? "External wallet" : "Embedded wallet" },
                { k: "Network", v: ARC_NETWORK_NAMES[defaultNetwork()] },
              ]}
            />
            <p className="body3">{wallet?.type === "external" ? "Your key stays in your own wallet app." : "Export your key from the account menu."}</p>
          </Card>
          {me?.org && SignerSection && (
            <Suspense fallback={<LoadingCard label="Loading seller signer" lines={2} />}>
              <SignerSection />
            </Suspense>
          )}
        </div>
        <div className={h.stack}>
          <Card title="Session" padding="compact">
            <div>
              <ActionButton
                variant="secondary"
                iconLeft={<LogOut size={16} strokeWidth={2} />}
                onClick={async () => {
                  await logout();
                  navigate("/", { replace: true });
                }}
              >
                Sign out
              </ActionButton>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
