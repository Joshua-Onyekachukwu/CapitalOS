import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "elevated";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-white dark:bg-dark border border-gray-200 dark:border-gray-800",
      bordered: "bg-white dark:bg-dark border-2 border-[#f1f5f9] dark:border-gray-700",
      elevated: "bg-white dark:bg-[#1a2332] shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[15px] md:rounded-[20px]",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-[20px] md:px-[25px] py-[18px] md:py-[22px] border-b border-gray-100 dark:border-gray-800", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-[20px] md:px-[25px] py-[20px] md:py-[25px]", className)}
    {...props}
  />
));
CardBody.displayName = "CardBody";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-[20px] md:px-[25px] py-[16px] md:py-[20px] border-t border-gray-100 dark:border-gray-800", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardBody, CardFooter };
export type { CardProps };
