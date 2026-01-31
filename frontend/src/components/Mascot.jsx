import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Mascot = ({
    mood = 'neutral',
    position = 'hero',
    size = 'md',
    avatar = 'mascot', // 'mascot', 'mascot_hat', 'mascot_hat_glasses', 'mascot_golden_shoes', 'mascot_legend'
    className = ''
}) => {
    // Mascot animations based on mood
    const animations = {
        neutral: {
            y: [0, -10, 0],
            transition: {
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut"
            }
        },
        excited: {
            scale: [1, 1.1, 1, 1.1, 1],
            rotate: [0, 5, -5, 5, 0],
            y: [0, -20, 0],
            transition: {
                duration: 0.8,
                times: [0, 0.25, 0.5, 0.75, 1]
            }
        },
        wave: {
            rotate: [0, 15, 0, 15, 0, 15, 0],
            transition: {
                duration: 1.5,
                times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1]
            }
        },
        thinking: {
            rotate: [-5, 5, -5],
            transition: {
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut"
            }
        }
    };

    // Position presets
    const positions = {
        hero: 'absolute -bottom-8 right-0 md:right-8',
        floating: 'fixed bottom-8 right-8 z-50',
        avatar: 'inline-block',
        center: 'mx-auto'
    };

    // Size presets
    const sizes = {
        sm: 'w-16 h-16',
        md: 'w-24 h-24',
        lg: 'w-32 h-32',
        xl: 'w-40 h-40 md:w-56 md:h-56'
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    ...animations[mood]
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                className={`${positions[position]} ${sizes[size]} ${className}`}
            >
                <motion.img
                    src={`/assets/avatar/${avatar}.png`}
                    alt="EduSign Mascot"
                    className="w-full h-full object-contain drop-shadow-2xl"
                    whileHover={{
                        scale: 1.05,
                        rotate: [0, -5, 5, 0],
                        transition: { duration: 0.3 }
                    }}
                />
            </motion.div>
        </AnimatePresence>
    );
};

export default Mascot;
