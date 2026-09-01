"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "label" | "error" | "hint"> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border-subtle bg-white/60 px-3.5 py-2 text-sm text-charcoal placeholder:text-charcoal-light/40",
          "focus:outline-none focus:ring-2 focus:ring-accent-peach/30 focus:border-accent-peach/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
          error && "border-accent-rose/50 focus:ring-accent-rose/30",
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-charcoal-light/50">
          {hint}
        </p>
      )}
    </div>
  )
);
FormField.displayName = "FormField";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "label" | "error" | "hint" | "options"> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ className, label, error, hint, id, options, placeholder, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border-subtle bg-white/60 px-3.5 py-2 text-sm text-charcoal",
          "focus:outline-none focus:ring-2 focus:ring-accent-peach/30 focus:border-accent-peach/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
          error && "border-accent-rose/50 focus:ring-accent-rose/30",
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-charcoal-light/50">
          {hint}
        </p>
      )}
    </div>
  )
);
SelectField.displayName = "SelectField";

interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "label" | "error" | "hint"> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          "flex w-full rounded-xl border border-border-subtle bg-white/60 px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-light/40",
          "focus:outline-none focus:ring-2 focus:ring-accent-peach/30 focus:border-accent-peach/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
          error && "border-accent-rose/50 focus:ring-accent-rose/30",
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-charcoal-light/50">
          {hint}
        </p>
      )}
    </div>
  )
);
TextareaField.displayName = "TextareaField";

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "label" | "error" | "hint" | "type"> {
  label?: string;
  error?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, label, error, hint, id, min, max, step, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border-subtle bg-white/60 px-3.5 py-2 text-sm text-charcoal placeholder:text-charcoal-light/40",
          "focus:outline-none focus:ring-2 focus:ring-accent-peach/30 focus:border-accent-peach/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors",
          error && "border-accent-rose/50 focus:ring-accent-rose/30",
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-charcoal-light/50">
          {hint}
        </p>
      )}
    </div>
  )
);
NumberInput.displayName = "NumberInput";