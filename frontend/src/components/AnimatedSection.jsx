import React from 'react';
import { motion } from 'framer-motion';

const AnimatedSection = ({
    children,
    delay = 0,
    className = '',
    direction = 'up' // 'up', 'down', 'left', 'right'
}) => {
    const directions = {
        up: { opacity: 0, y: 30 },
        down: { opacity: 0, y: -30 },
        left: { opacity: 0, x: 30 },
        right: { opacity: 0, x: -30 }
    };

    return (
        <motion.div
            initial={directions[direction]}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            transition={{
                duration: 0.6,
                ease: "easeOut",
                delay
            }}
            viewport={{
                once: true,
                margin: "-100px"
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export default AnimatedSection;
