import * as React from "react";

const Separator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr ref={ref} className={className} {...props} />
  )
);
Separator.displayName = "Separator";

export { Separator };
