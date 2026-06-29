import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PhasePlaceholder({
  phase,
  children,
}: {
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
          <Construction className="h-6 w-6 text-volvo-blue" />
        </div>
        <Badge variant="secondary">{phase}</Badge>
        <p className="max-w-md text-sm text-muted-foreground">
          {children ??
            "Denne delen bygges ut i en kommende fase. Grunnmuren, navigasjonen og innloggingen er på plass."}
        </p>
      </CardContent>
    </Card>
  );
}
