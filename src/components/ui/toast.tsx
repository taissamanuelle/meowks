import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  cn(
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl p-4 pr-9 transition-all",
    "bg-[hsl(0,0%,14%)]/95 backdrop-blur-xl",
    "border border-[hsl(0,0%,22%)] border-b-[hsl(0,0%,8%)]",
    "shadow-[0_12px_40px_hsla(0,0%,0%,0.5),0_4px_12px_hsla(0,0%,0%,0.35),inset_0_1px_0_hsla(0,0%,100%,0.07)]",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  ),
  {
    variants: {
      variant: {
        default: "",
        destructive: "border-red-500/30 [&_.toast-icon]:text-red-400",
        success: "border-primary/30 [&_.toast-icon]:text-primary",
        warning: "border-amber-500/30 [&_.toast-icon]:text-amber-400",
        info: "border-blue-400/30 [&_.toast-icon]:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const variantIcons = {
  default: Info,
  destructive: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, children, ...props }, ref) => {
  const IconComponent = variantIcons[variant || "default"];
  return (
    <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props}>
      <IconComponent className="toast-icon mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">{children}</div>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[hsl(0,0%,24%)] px-3 text-sm font-medium transition-colors",
      "bg-[hsla(0,0%,100%,0.05)] hover:bg-[hsla(0,0%,100%,0.1)]",
      "text-foreground/80 hover:text-foreground",
      "focus:outline-none focus:ring-1 focus:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-red-500/30 group-[.destructive]:hover:border-red-500/50 group-[.destructive]:hover:bg-red-500/10 group-[.destructive]:text-red-400",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2.5 top-2.5 rounded-lg p-1 text-foreground/30 transition-all duration-150",
      "opacity-0 group-hover:opacity-100",
      "hover:text-foreground/70 hover:bg-[hsla(0,0%,100%,0.08)]",
      "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold text-foreground", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm text-foreground/60 mt-0.5", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
