"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  loading = false,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass-strong rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-charcoal tracking-tight">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-subtle">{description}</p>
        )}
        {children && (
          <div className="mt-4">{children}</div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isConfirming || loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            loading={isConfirming || loading}
            disabled={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}