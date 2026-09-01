"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "variant" | "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed btn-pill";

    const variants: Record<ButtonVariant, string> = {
      primary: "bg-charcoal text-white hover:bg-charcoal/90 focus:ring-charcoal/20 shadow-sm",
      secondary: "bg-charcoal/5 text-charcoal hover:bg-charcoal/10 focus:ring-charcoal/10",
      outline: "border border-charcoal/10 bg-white/60 text-charcoal hover:bg-white/80 focus:ring-charcoal/10",
      destructive: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/20",
      ghost: "text-charcoal-light hover:bg-charcoal/5 hover:text-charcoal focus:ring-charcoal/10",
    };

    const sizes: Record<ButtonSize, string> = {
      sm: "h-8 px-3.5 text-xs",
      md: "h-10 px-5 text-sm",
      lg: "h-12 px-7 text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";