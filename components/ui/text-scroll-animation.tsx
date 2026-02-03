"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ReactLenis } from "lenis/react";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";

type CharacterProps = {
    char: string;
    index: number;
    centerIndex: number;
    scrollYProgress: any;
};

const CharacterV1 = ({
    char,
    index,
    centerIndex,
    scrollYProgress,
}: CharacterProps) => {
    const isSpace = char === " ";
    const distanceFromCenter = index - centerIndex;

    const x = useTransform(scrollYProgress, [0, 0.5], [distanceFromCenter * 50, 0]);
    const rotateX = useTransform(scrollYProgress, [0, 0.5], [distanceFromCenter * 50, 0]);

    return (
        <motion.span
            className={cn("inline-block text-orange-500", isSpace && "w-4")}
            style={{ x, rotateX }}
        >
            {char}
        </motion.span>
    );
};

const CharacterV2 = ({
    char,
    index,
    centerIndex,
    scrollYProgress,
}: CharacterProps) => {
    const distanceFromCenter = index - centerIndex;

    const x = useTransform(scrollYProgress, [0, 0.5], [distanceFromCenter * 50, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [0.75, 1]);
    const y = useTransform(scrollYProgress, [0, 0.5], [Math.abs(distanceFromCenter) * 50, 0]);

    return (
        <motion.img
            src={char}
            alt=""
            className="h-16 w-16 shrink-0 object-contain will-change-transform"
            style={{ x, scale, y, transformOrigin: "center" }}
        />
    );
};

const CharacterV3 = ({
    char,
    index,
    centerIndex,
    scrollYProgress,
}: CharacterProps) => {
    const distanceFromCenter = index - centerIndex;

    const x = useTransform(scrollYProgress, [0, 0.5], [distanceFromCenter * 90, 0]);
    const rotate = useTransform(scrollYProgress, [0, 0.5], [distanceFromCenter * 50, 0]);
    const y = useTransform(scrollYProgress, [0, 0.5], [-Math.abs(distanceFromCenter) * 20, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [0.75, 1]);

    return (
        <motion.img
            src={char}
            alt=""
            className="h-16 w-16 shrink-0 object-contain will-change-transform"
            style={{ x, rotate, y, scale, transformOrigin: "center" }}
        />
    );
};

const TextScrollAnimation = () => {
    const targetRef = useRef<HTMLDivElement | null>(null);
    const targetRef2 = useRef<HTMLDivElement | null>(null);
    const targetRef3 = useRef<HTMLDivElement | null>(null);

    const { scrollYProgress } = useScroll({ target: targetRef });
    const { scrollYProgress: scrollYProgress2 } = useScroll({ target: targetRef2 });
    const { scrollYProgress: scrollYProgress3 } = useScroll({ target: targetRef3 });

    const text = "see more from ";
    const characters = text.split("");
    const centerIndex = Math.floor(characters.length / 2);

    const macIcon = [
        "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/discord.svg",
        "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/figma.svg",
        "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/framer.svg",
        "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/github.svg",
        "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/mongodb.svg",
        "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/notion.svg",
    ];
    const iconCenterIndex = Math.floor(macIcon.length / 2);

    return (
        <ReactLenis root>
            <div className="w-full bg-white text-black">
                {/* Scroll Indicator */}
                <div className="fixed top-22 left-1/2 z-10 grid -translate-x-1/2 content-start justify-items-center gap-6 text-center">
                    <span className="relative max-w-[12ch] text-xs uppercase leading-tight opacity-40 after:absolute after:left-1/2 after:top-full after:h-16 after:w-px after:bg-gradient-to-b after:from-[#f5f4f3] after:to-black after:content-['']">
                        Scroll to see more
                    </span>
                </div>

                {/* Section 1: Text Animation */}
                <div ref={targetRef} className="h-[200vh] relative">
                    <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
                        <div className="flex">
                            {characters.map((char, i) => (
                                <CharacterV1
                                    key={`v1-${i}`}
                                    char={char}
                                    index={i}
                                    centerIndex={centerIndex}
                                    scrollYProgress={scrollYProgress}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Section 2: Icons Animation (V2) */}
                <div ref={targetRef2} className="h-[200vh] relative">
                    <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
                        <div className="flex gap-4">
                            {macIcon.map((icon, i) => (
                                <CharacterV2
                                    key={`v2-${i}`}
                                    char={icon}
                                    index={i}
                                    centerIndex={iconCenterIndex}
                                    scrollYProgress={scrollYProgress2}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Section 3: Icons Animation (V3) */}
                <div ref={targetRef3} className="h-[200vh] relative">
                    <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
                        <div className="flex gap-4">
                            {macIcon.map((icon, i) => (
                                <CharacterV3
                                    key={`v3-${i}`}
                                    char={icon}
                                    index={i}
                                    centerIndex={iconCenterIndex}
                                    scrollYProgress={scrollYProgress3}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-screen flex items-center justify-center">
                    <p className="text-xl opacity-50">End of animation</p>
                </div>
            </div>
        </ReactLenis>
    );
};

export default TextScrollAnimation;
