import * as React from "react"
import { cn } from "@/utils/cn"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  let variantClasses = "";
  switch (variant) {
    case "default": variantClasses = "border-transparent bg-primary text-primary-foreground hover:bg-primary/80"; break;
    case "secondary": variantClasses = "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"; break;
    case "destructive": variantClasses = "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80"; break;
    case "success": variantClasses = "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"; break;
    case "outline": variantClasses = "text-foreground"; break;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantClasses,
        className
      )}
      {...props}
    />
  )
}

export { Badge }
