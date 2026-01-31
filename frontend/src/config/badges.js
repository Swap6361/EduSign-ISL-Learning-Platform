export const getAllBadges = () => [
    // --- STAGE 1: SIGN BASICS ADVENTURE (sign_basics) ---
    {
        id: 'alpha_starter',
        name: 'Alphabet Starter',
        description: 'Learn 5 letters',
        condition: (progress) => (progress?.completedLetters?.length || 0) >= 5,
        icon: '/assets/badges/badge_alpha_starter.png',
        category: 'sign_basics'
    },
    {
        id: 'alpha_halfway',
        name: 'Alphabet Explorer',
        description: 'Learn 13 letters',
        condition: (progress) => (progress?.completedLetters?.length || 0) >= 13,
        icon: '/assets/badges/badge_alpha_halfway.png',
        category: 'sign_basics'
    },
    {
        id: 'alpha_master',
        name: 'Alphabet Master',
        description: 'Master all 26 letters',
        condition: (progress) => (progress?.completedLetters?.length || 0) >= 26,
        icon: '/assets/badges/badge_alpha_master.png',
        category: 'sign_basics'
    },
    {
        id: 'num_starter',
        name: 'Number Starter',
        description: 'Learn 5 numbers',
        condition: (progress) => (progress?.completedNumbers?.length || 0) >= 5,
        icon: '/assets/badges/badge_num_starter.png',
        category: 'sign_basics'
    },
    {
        id: 'num_master',
        name: 'Number Master',
        description: 'Master all 10 numbers',
        condition: (progress) => (progress?.completedNumbers?.length || 0) >= 10,
        icon: '/assets/badges/badge_num_master.png',
        category: 'sign_basics'
    },
    {
        id: 'sign_basics_complete',
        name: 'Sign Basics Champion',
        description: 'Complete Alphabet & Numbers!',
        condition: (progress) =>
            (progress?.completedLetters?.length || 0) >= 26 &&
            (progress?.completedNumbers?.length || 0) >= 10,
        icon: '/assets/badges/badge_sign_basics_complete.png',
        category: 'sign_basics'
    },

    // --- STAGE 2: WORD WONDERLAND (word_wonderland) ---
    // A-Z Words
    {
        id: 'az_word_starter',
        name: 'Word Starter',
        description: 'Learn 5 A-Z words',
        condition: (progress) => (progress?.completedAZWords?.length || 0) >= 5,
        icon: '/assets/badges/badge_word_starter.png', // Reusing existing
        category: 'word_wonderland'
    },
    {
        id: 'az_word_half',
        name: 'Word Builder',
        description: 'Learn 13 A-Z words',
        condition: (progress) => (progress?.completedAZWords?.length || 0) >= 13,
        icon: '/assets/badges/badge_az_word_half.png',
        category: 'word_wonderland'
    },
    {
        id: 'az_word_master',
        name: 'A-Z Word Master',
        description: 'Master all 26 A-Z words',
        condition: (progress) => (progress?.completedAZWords?.length || 0) >= 26,
        icon: '/assets/badges/badge_az_word_master.png',
        category: 'word_wonderland'
    },
    // Days
    {
        id: 'days_complete',
        name: 'Week Hero',
        description: 'Master all 7 days',
        condition: (progress) => (progress?.completedDays?.length || 0) >= 7,
        icon: '/assets/badges/badge_week_hero.png',
        category: 'word_wonderland'
    },
    // Colors
    {
        id: 'color_starter',
        name: 'Color Beginner',
        description: 'Learn 5 colors',
        condition: (progress) => (progress?.completedColors?.length || 0) >= 5,
        icon: '/assets/badges/badge_colour_beginner.png', // Reusing existing
        category: 'word_wonderland'
    },
    {
        id: 'color_master',
        name: 'Rainbow Master',
        description: 'Master all 11 colors',
        condition: (progress) => (progress?.completedColors?.length || 0) >= 11,
        icon: '/assets/badges/badge_rainbow_champ.png', // Reusing existing
        category: 'word_wonderland'
    },
    // Action Alley (Motion Words)
    {
        id: 'action_starter',
        name: 'Action Starter',
        description: 'Learn 5 action words',
        condition: (progress) => (progress?.completedGen1?.length || 0) >= 5,
        icon: '/assets/badges/badge_motion_starter.png', // Reusing existing
        category: 'word_wonderland'
    },
    {
        id: 'action_learner',
        name: 'Action Learner',
        description: 'Learn 12 action words',
        condition: (progress) => (progress?.completedGen1?.length || 0) >= 12,
        icon: '/assets/badges/badge_action_learner.png',
        category: 'word_wonderland'
    },
    {
        id: 'action_master',
        name: 'Action Master',
        description: 'Master all 24 action words',
        condition: (progress) => (progress?.completedGen1?.length || 0) >= 24,
        icon: '/assets/badges/badge_action_hero.png', // Reusing existing
        category: 'word_wonderland'
    },
    // Idea Island (Static Words)
    {
        id: 'idea_starter',
        name: 'Idea Starter',
        description: 'Learn 5 idea words',
        condition: (progress) => (progress?.completedGen2?.length || 0) >= 5,
        icon: '/assets/badges/badge_idea_starter.png',
        category: 'word_wonderland'
    },
    {
        id: 'idea_builder',
        name: 'Idea Builder',
        description: 'Learn 10 idea words',
        condition: (progress) => (progress?.completedGen2?.length || 0) >= 10,
        icon: '/assets/badges/badge_idea_builder.png',
        category: 'word_wonderland'
    },
    {
        id: 'idea_master',
        name: 'Idea Master',
        description: 'Master all 16 idea words',
        condition: (progress) => (progress?.completedGen2?.length || 0) >= 16,
        icon: '/assets/badges/badge_idea_master.png',
        category: 'word_wonderland'
    },
    // Aggregate
    {
        id: 'word_50',
        name: 'Vocabulary Star',
        description: 'Learn 50 total words',
        condition: (progress) => {
            const total = (progress?.completedAZWords?.length || 0) +
                (progress?.completedDays?.length || 0) +
                (progress?.completedColors?.length || 0) +
                (progress?.completedGen1?.length || 0) +
                (progress?.completedGen2?.length || 0);
            return total >= 50;
        },
        icon: '/assets/badges/badge_vocab_star.png',
        category: 'word_wonderland'
    },
    {
        id: 'word_all',
        name: 'Wonderland Champion',
        description: 'Master all 84 words!',
        condition: (progress) => {
            const total = (progress?.completedAZWords?.length || 0) +
                (progress?.completedDays?.length || 0) +
                (progress?.completedColors?.length || 0) +
                (progress?.completedGen1?.length || 0) +
                (progress?.completedGen2?.length || 0);
            return total >= 84;
        },
        icon: '/assets/badges/badge_wonderland_champ.png',
        category: 'word_wonderland'
    },

    // --- STAGE 3: SENTENCE SAFARI (sentence_safari) ---
    {
        id: 'sentence_first',
        name: 'Sentence Beginner',
        description: 'Complete your first sentence',
        condition: (progress) => (progress?.completedSentences?.length || 0) >= 1,
        icon: '/assets/badges/badge_sentence_first.png',
        category: 'sentence_safari'
    },
    {
        id: 'sentence_mid',
        name: 'Sentence Builder',
        description: 'Complete 3 sentences',
        condition: (progress) => (progress?.completedSentences?.length || 0) >= 3,
        icon: '/assets/badges/badge_sentence_mid.png',
        category: 'sentence_safari'
    },
    {
        id: 'sentence_master',
        name: 'Sign Fluent',
        description: 'Master all 7 sentences',
        condition: (progress) => (progress?.completedSentences?.length || 0) >= 7,
        icon: '/assets/badges/badge_sentence_master.png',
        category: 'sentence_safari'
    },

    // --- FINAL GRAND ACHIEVEMENT ---
    {
        id: 'sign_language_legend',
        name: 'Sign Language Legend',
        description: 'Completed all EduSign Adventures',
        condition: (progress) => {
            const signBasics = (progress?.completedLetters?.length || 0) >= 26 && (progress?.completedNumbers?.length || 0) >= 10;
            const wordWonderland = (
                (progress?.completedAZWords?.length || 0) +
                (progress?.completedDays?.length || 0) +
                (progress?.completedColors?.length || 0) +
                (progress?.completedGen1?.length || 0) +
                (progress?.completedGen2?.length || 0)
            ) >= 84;
            const sentenceSafari = (progress?.completedSentences?.length || 0) >= 7;
            return signBasics && wordWonderland && sentenceSafari;
        },
        icon: '/assets/badges/trophy_legend.png',
        category: 'global'
    }
];

export const getBadgesByCategory = (category) => {
    return getAllBadges().filter(badge => badge.category === category);
};
