"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollSectionProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}

export function ScrollSection({ children, className, delay = 0 }: ScrollSectionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
                duration: 0.65,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className={cn("w-full", className)}
        >
            {children}
        </motion.div>
    );
}
