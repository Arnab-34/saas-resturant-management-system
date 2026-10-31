import { cn } from "@/lib/utils";

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/astrik-logo.png"
      alt="Astrikcoders"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-lg object-contain", className)}
    />
  );
}
