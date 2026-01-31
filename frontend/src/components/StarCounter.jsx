import React from 'react';
import { motion } from 'framer-motion';

const StarCounter = ({
    count = 0,
    total = 5,
    size = 'md' // 'sm', 'md', 'lg'
}) => {
    const sizes = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-4xl'
    };

    return (
        <div className="flex items-center gap-2">
            {[...Array(total)].map((_, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    animate={{
                        opacity: index < count ? 1 : 0.3,
                        scale: index < count ? 1 : 0.8,
                        rotate: 0
                    }}
                    transition={{
                        delay: index * 0.1,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 200
                    }}
                    whileHover={index < count ? {
                        scale: 1.2,
                        rotate: [0, -10, 10, 0],
                        transition: { duration: 0.3 }
                    } : {}}
                    className={`${sizes[size]} ${index < count ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                    ⭐
                </motion.div>
            ))}

            {total > 5 && (
                <motion.span
                    className="ml-2 text-sm font-semibold text-gray-600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: total * 0.1 }}
                >
                    {count}/{total}
                </motion.span>
            )}
        </div>
    );
};

export default StarCounter;
