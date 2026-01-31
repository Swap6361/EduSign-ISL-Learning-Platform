// Progress Manager - Handles all progress tracking logic

const STORAGE_KEY = 'eduSignProgress';

// Default progress structure
const DEFAULT_PROGRESS = {
  completedLetters: [],
  badges: [],
  streak: 0,
  totalScore: 0,
  accuracy: 0,
  totalTime: 0,
  lastPracticeDate: null,
  sessionStats: {
    correctPredictions: 0,
    totalPredictions: 0
  }
};

// Badge thresholds
const BADGE_REQUIREMENTS = {
  'First Steps': { type: 'letters', threshold: 5 },
  'Halfway Hero': { type: 'letters', threshold: 13 },
  'Alphabet Master': { type: 'letters', threshold: 26 },
  'Speed Demon': { type: 'session', threshold: 10 },
  'Perfect Week': { type: 'streak', threshold: 7 },
  'Early Bird': { type: 'time', threshold: 9 }
};

/**
 * Get current progress from localStorage
 */
export const getProgress = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return DEFAULT_PROGRESS;
  } catch (error) {
    console.error('Error loading progress:', error);
    return DEFAULT_PROGRESS;
  }
};

/**
 * Save progress to localStorage
 */
export const saveProgress = (progress) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    console.log('✓ Progress saved:', progress);
    return true;
  } catch (error) {
    console.error('Error saving progress:', error);
    return false;
  }
};

/**
 * Update progress with new data
 */
export const updateProgress = (updates) => {
  const current = getProgress();
  const updated = { ...current, ...updates };
  saveProgress(updated);
  return updated;
};

/**
 * Mark a letter as complete
 */
export const markLetterComplete = (letter) => {
  const progress = getProgress();
  
  if (progress.completedLetters.includes(letter)) {
    console.log(`Letter ${letter} already completed`);
    return progress;
  }

  // Add letter to completed list
  progress.completedLetters.push(letter);
  progress.completedLetters.sort();

  // Award points
  progress.totalScore += 100;

  // Update accuracy
  const session = progress.sessionStats;
  progress.accuracy = session.totalPredictions > 0
    ? Math.round((session.correctPredictions / session.totalPredictions) * 100)
    : 0;

  // Check for new badges
  const newBadges = checkBadges(progress);
  progress.badges = [...new Set([...progress.badges, ...newBadges])];

  // Update streak
  updateStreak(progress);

  saveProgress(progress);
  return progress;
};

/**
 * Check if user earned any new badges
 */
const checkBadges = (progress) => {
  const earnedBadges = [];

  for (const [badgeName, requirement] of Object.entries(BADGE_REQUIREMENTS)) {
    // Skip if already earned
    if (progress.badges.includes(badgeName)) continue;

    switch (requirement.type) {
      case 'letters':
        if (progress.completedLetters.length >= requirement.threshold) {
          earnedBadges.push(badgeName);
        }
        break;
      
      case 'streak':
        if (progress.streak >= requirement.threshold) {
          earnedBadges.push(badgeName);
        }
        break;
      
      case 'session':
        // This would be tracked separately in a real implementation
        break;
      
      case 'time':
        const hour = new Date().getHours();
        if (hour < requirement.threshold) {
          earnedBadges.push(badgeName);
        }
        break;
    }
  }

  return earnedBadges;
};

/**
 * Update practice streak
 */
const updateStreak = (progress) => {
  const today = new Date().toDateString();
  const lastPractice = progress.lastPracticeDate;

  if (!lastPractice) {
    // First time practicing
    progress.streak = 1;
  } else {
    const lastDate = new Date(lastPractice);
    const todayDate = new Date(today);
    const diffTime = todayDate - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, maintain streak
    } else if (diffDays === 1) {
      // Consecutive day
      progress.streak += 1;
    } else {
      // Streak broken
      progress.streak = 1;
    }
  }

  progress.lastPracticeDate = today;
};

/**
 * Record a prediction attempt
 */
export const recordPrediction = (isCorrect) => {
  const progress = getProgress();
  
  progress.sessionStats.totalPredictions += 1;
  if (isCorrect) {
    progress.sessionStats.correctPredictions += 1;
  }

  // Update accuracy
  const session = progress.sessionStats;
  progress.accuracy = Math.round((session.correctPredictions / session.totalPredictions) * 100);

  saveProgress(progress);
  return progress;
};

/**
 * Reset all progress
 */
export const resetProgress = () => {
  saveProgress(DEFAULT_PROGRESS);
  console.log('✓ Progress reset');
  return DEFAULT_PROGRESS;
};

/**
 * Export progress as JSON
 */
export const exportProgress = () => {
  const progress = getProgress();
  const dataStr = JSON.stringify(progress, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportName = `edusign-progress-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportName);
  linkElement.click();
};

/**
 * Import progress from JSON
 */
export const importProgress = (jsonData) => {
  try {
    const progress = JSON.parse(jsonData);
    saveProgress(progress);
    return true;
  } catch (error) {
    console.error('Error importing progress:', error);
    return false;
  }
};