"use client";

import { memo } from "react";
import { useOdometer } from "./hooks";

export const Odometer = memo(function Odometer({
  value,
  format,
  className,
  duration,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const display = useOdometer(value, duration);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(display)}
    </span>
  );
});
