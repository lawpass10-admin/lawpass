import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Plain shadcn-style textarea. Mirrors Input's chrome (border-input,
 * focus-visible ring, aria-invalid styling) so RHF form rows look
 * uniform whether they're <Input> or <Textarea>.
 *
 * @base-ui/react doesn't ship a Textarea primitive, so this is a bare
 * <textarea> with the same className stack. dir="auto" is left to the
 * caller — Hebrew copy benefits from it, but a code-only textarea
 * shouldn't.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
