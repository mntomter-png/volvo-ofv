import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import type { BrandConfig } from "@/lib/brand/config";
import type { Role } from "@/lib/auth/role-config";

export function Header({
  email,
  role,
  brand,
}: {
  email: string;
  role: Role;
  brand: BrandConfig;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
      <MobileNav role={role} brand={brand} />

      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight">
          {brand.appTitle}
        </span>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          Markedsinnsikt
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu email={email} />
      </div>
    </header>
  );
}
