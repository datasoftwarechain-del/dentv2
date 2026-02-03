"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface ScrollSectionProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}

export function ScrollSection({ children, className, delay = 0 }: ScrollSectionProps) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["0 1", "0.8 0.5"],
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 20,
        restDelta: 0.001
    });

    const scale = useTransform(smoothProgress, [0, 1], [0.95, 1]);
    const opacity = useTransform(smoothProgress, [0, 0.5], [0, 1]);
    const y = useTransform(smoothProgress, [0, 1], [50, 0]);

    return (
        <motion.div
            ref={ref}
            style={{
                scale,
                opacity,
                y,
            }}
            className={cn("w-full", className)}
        >
            {children}
        </motion.div>
    );
}
