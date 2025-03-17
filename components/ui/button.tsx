import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    className,
    children,
    disabled,
    type = "button",
    ...props
}, ref) => {
    return (
        <button className={cn(
            `w-auto rounded-full bg-black border-transparent px-5 py-3 disabled:cursor-not-allowed font-semibold hover:opacity-75 transition`,
            className
        )} disabled={disabled} ref={ref} {...props}>
            {children}
        </button>
    );
})

export default Button;