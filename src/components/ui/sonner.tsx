import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:bg-[hsl(0,0%,14%)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-[hsl(0,0%,22%)] group-[.toaster]:border-b-[hsl(0,0%,8%)] group-[.toaster]:shadow-[0_12px_40px_hsla(0,0%,0%,0.5),0_4px_12px_hsla(0,0%,0%,0.35),inset_0_1px_0_hsla(0,0%,100%,0.07)]",
          description: "group-[.toast]:text-foreground/60",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
