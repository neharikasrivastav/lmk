import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Heart, Check, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitPartner } from "@/lib/lmk.functions";
import { PARTNER_PRICE } from "@/lib/walk";
export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Lmk — Become a verified stop" },
      {
        name: "description",
        content: "Welcome walkers into your café. Join the Lmk neighborhood partner network.",
      },
      { property: "og:title", content: "Lmk neighborhood partners" },
      {
        property: "og:description",
        content: "A warm welcome makes a difference. Free listings and verified partnerships.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Partners,
});
function Partners() {
  const submit = useServerFn(submitPartner);
  const [tier, setTier] = useState<"free" | "verified">("free");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <nav className="mb-12 flex items-center justify-between">
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft />
              Back to walk
            </Link>
          </Button>
          <span className="lmk-logo flex items-center gap-2">
            lmk
            <Heart className="size-5 fill-accent-foreground text-accent-foreground" />
          </span>
        </nav>
        <Coffee className="mb-5 size-10 text-accent-foreground" />
        <h1 className="font-display text-4xl font-extrabold">
          A little welcome.
          <br />A big difference.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Become a verified stop. Give women walking alone a welcoming place to pause, grab a
          coffee, or wait for a ride.
        </p>
        <div className="my-9 grid gap-5 border-y border-border py-7 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">More neighborhood foot traffic</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Meet nearby walkers and become a trusted neighborhood space.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">A simple commitment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep staff informed and let walkers wait inside until their ride arrives.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={tier === "free" ? "secondary" : "outline"}
            className="h-auto flex-col items-start px-5 py-5"
            onClick={() => setTier("free")}
          >
            <span className="font-semibold">Free listing</span>
            <span className="text-2xl">$0</span>
            <span className="text-xs">Your place on the map</span>
          </Button>
          <Button
            variant={tier === "verified" ? "secondary" : "outline"}
            className="h-auto flex-col items-start px-5 py-5"
            onClick={() => setTier("verified")}
          >
            <span className="font-semibold">Verified Partner</span>
            <span className="text-2xl">
              ${PARTNER_PRICE}
              <span className="text-xs"> / month</span>
            </span>
            <span className="text-xs">Badge + priority placement</span>
          </Button>
        </div>
        <h2 className="mb-5 mt-10 font-display text-2xl font-bold">Let’s meet your café.</h2>
        {state === "saved" ? (
          <div role="status" className="bg-secondary p-6">
            <Check className="mb-3" />
            <h3 className="text-xl font-semibold">Your request is in.</h3>
            <p className="mt-2">
              Thank you for making room for your neighbors. No payment has been collected.
            </p>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setState("");
              const f = new FormData(e.currentTarget);
              try {
                await submit({
                  data: {
                    business: String(f.get("business")),
                    name: String(f.get("name")),
                    email: String(f.get("email")),
                    address: String(f.get("address")),
                    tier,
                    commitments: true,
                    website: String(f.get("website") ?? ""),
                  },
                });
                setState("saved");
              } catch {
                setState("Could not save your request. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {[
              ["business", "Business name"],
              ["name", "Your name"],
              ["email", "Email"],
              ["address", "Business address"],
            ].map(([name, label]) => (
              <label key={name} className="block text-sm font-medium">
                {label}
                <input
                  name={name}
                  type={name === "email" ? "email" : "text"}
                  required
                  minLength={name === "address" ? 5 : 2}
                  maxLength={200}
                  className="mt-2 h-12 w-full rounded-lg border border-input bg-card px-4 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
            <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
            <label className="flex gap-3 text-sm">
              <input type="checkbox" required className="size-5 shrink-0 accent-primary" />
              Our staff will be aware of Lmk, and walkers may wait inside until a ride arrives.
            </label>
            {state && (
              <p role="alert" className="text-destructive">
                {state}
              </p>
            )}
            <Button disabled={busy} className="tap w-full">
              {busy ? "Sending…" : "Request to join"}
              <Heart />
            </Button>
            <p className="text-xs text-muted-foreground">
              This is a partnership request, not a subscription purchase.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
