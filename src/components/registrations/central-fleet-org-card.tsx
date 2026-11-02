"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  removeCentralFleetOrg,
  saveCentralFleetOrg,
} from "@/lib/fleet/central-org-actions";
import {
  formatOrgNr,
  type CentralFleetOrg,
} from "@/lib/fleet/central-orgs";

export function CentralFleetOrgCard({
  orgs,
  loadError,
}: {
  orgs: CentralFleetOrg[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orgnr, setOrgnr] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(
    work: () => Promise<{ error?: string }>,
    success: string,
    onSuccess?: () => void,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      setMessage(success);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sentrale flåteorganisasjoner</CardTitle>
        <CardDescription>
          Kun Region tar ut konkurrentbiler der eier, bruker eller
          leasingselskap står på listen. Volvo Fleet styres fortsatt av
          VIN-registeret. Listen er importører og sentrale salgsselskap, ikke
          kundene på en nasjonal avtale. Registreringen sier ikke hvilken
          forhandler som solgte bilen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        {orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen organisasjoner i listen.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {orgs.map((org) => (
              <li
                key={org.orgnr}
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatOrgNr(org.orgnr)}
                    {org.active ? "" : " · skjult"}
                  </p>
                  {org.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">{org.note}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={org.active}
                      disabled={isPending}
                      onChange={(event) => {
                        const active = event.target.checked;
                        run(
                          () =>
                            saveCentralFleetOrg({
                              orgnr: org.orgnr,
                              name: org.name,
                              note: org.note ?? "",
                              active,
                            }),
                          active
                            ? `${org.name} er med i Kun Region.`
                            : `${org.name} er skjult fra Kun Region.`,
                        );
                      }}
                    />
                    Aktiv
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm(`Fjerne ${org.name} fra listen?`)) {
                        return;
                      }
                      run(
                        () => removeCentralFleetOrg(org.orgnr),
                        `${org.name} er fjernet.`,
                      );
                    }}
                  >
                    Fjern
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                saveCentralFleetOrg({
                  orgnr,
                  name,
                  note,
                  active: true,
                }),
              "Organisasjonen er lagt til.",
              () => {
                setOrgnr("");
                setName("");
                setNote("");
              },
            );
          }}
        >
          <p className="text-sm font-medium text-foreground">Legg til</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="central-fleet-orgnr">Org.nr.</Label>
              <Input
                id="central-fleet-orgnr"
                inputMode="numeric"
                autoComplete="off"
                value={orgnr}
                disabled={isPending}
                onChange={(event) => setOrgnr(event.target.value)}
                placeholder="999 999 999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="central-fleet-name">Navn</Label>
              <Input
                id="central-fleet-name"
                value={name}
                disabled={isPending}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="central-fleet-note">Merknad</Label>
            <Textarea
              id="central-fleet-note"
              value={note}
              disabled={isPending}
              maxLength={500}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Legg til
          </Button>
        </form>

        {message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
