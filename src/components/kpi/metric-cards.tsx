import type { LucideIcon } from "lucide-react";

import {
  YoYIndicator,
  type YoYMode,
  type YoYSentiment,
} from "@/components/kpi/yoy-indicator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MetricCardYoY {
  current: number;
  previous: number;
  periodLabel: string;
  mode: YoYMode;
  sentiment: YoYSentiment;
}

export interface MetricCardConfig {
  key: string;
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  footnote?: string;
  yoy?: MetricCardYoY | null;
  onClick?: () => void;
}

interface MetricCardsProps {
  cards: readonly MetricCardConfig[];
}

export function MetricCards({ cards }: MetricCardsProps) {
  const columnClass =
    cards.length >= 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : "sm:grid-cols-3";

  return (
    <div className={cn("grid gap-4", columnClass)}>
      {cards.map((card) => {
        const Icon = card.icon;
        const content = (
          <Card
            className={cn(
              "overflow-hidden",
              card.onClick &&
                "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md bg-volvo-blue/8",
                )}
              >
                <Icon className="h-4 w-4 text-volvo-blue" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums tracking-tight">
                {card.value}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {card.description}
              </p>
              {card.footnote ? (
                <p className="mt-1 text-sm text-muted-foreground">{card.footnote}</p>
              ) : null}
              {card.onClick ? (
                <p className="mt-2 text-xs text-primary">Klikk for å se eiere</p>
              ) : null}
              {card.yoy ? (
                <YoYIndicator
                  current={card.yoy.current}
                  previous={card.yoy.previous}
                  periodLabel={card.yoy.periodLabel}
                  mode={card.yoy.mode}
                  sentiment={card.yoy.sentiment}
                />
              ) : null}
            </CardContent>
          </Card>
        );

        if (card.onClick) {
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className="text-left"
            >
              {content}
            </button>
          );
        }

        return content;
      })}
    </div>
  );
}
