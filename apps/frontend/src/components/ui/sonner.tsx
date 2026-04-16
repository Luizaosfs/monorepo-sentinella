/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Referência estável — objeto novo a cada render reexecutava efeitos internos do Sonner. */
const SONNER_TOAST_OPTIONS: ToasterProps["toastOptions"] = {
  classNames: {
    toast:
      "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
    description: "group-[.toast]:text-muted-foreground",
    actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
    cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
  },
};

const Toaster = forwardRef<HTMLDivElement, ToasterProps>(({ ...props }, _ref) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={SONNER_TOAST_OPTIONS}
      {...props}
    />
  );
});
Toaster.displayName = "Toaster";

export { Toaster, toast };
