"use client";

import { Button } from "@/components/ui/Button";

export default function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <i className="ri-printer-line text-[16px]"></i>
      Print / Save as PDF
    </Button>
  );
}
