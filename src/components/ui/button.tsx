import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-button-hover hover:text-button-hover-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-button-hover hover:text-button-hover-foreground",
        outline: "border border-input bg-background hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover",
        secondary: "bg-secondary/50 text-foreground hover:bg-button-hover hover:text-button-hover-foreground",
        ghost: "hover:bg-button-hover hover:text-button-hover-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-button-hover",
        golden: "bg-secondary text-foreground border border-border hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover",
        "golden-outline": "border-2 border-button-hover text-button-hover hover:bg-button-hover hover:text-button-hover-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        xl: "h-12 px-8 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
