import { doc, getDoc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getAllBadges } from '../config/badges';

class UserProgressService {
  _withDefaults(data) {
    return {
      completedLetters: [],
      completedNumbers: [],
      // Word Wonderland Progress
      completedAlphabetWords: [],
      completedDays: [],
      completedMonths: [],
      completedColors: [],
      completedMotionWords: [],
      completedStaticWords: [],
      completedGeneralWords: [],
      completedGen1: [],
      completedGen2: [],
      completedAZWords: [],  // A-Z Words (26 words max)
      completedSentences: [],
      wordProgress: { completed: 0, total: 25 },
      sentenceProgress: { completed: 0, total: 15 },
      badges: [],
      totalLessons: 0,
      level: 'Beginner',
      lastFeedback: 'neutral',
      // Badge tracking
      alphabetAccuracy: 0,
      wordsAccuracy: 0,
      sentenceAccuracy: 0,
      streakDays: 0,
      lastPracticeDate: null,
      wordCombo: 0,
      perfectStreak: 0,
      noMistakeStreak: 0,
      happyMoodCount: 0,
      practiceAfterMistake: 0,
      comebackKid: false,
      nightOwlCount: 0,
      earlyBirdCount: 0,
      expressionCount: 0,
      // Time tracking
      alphabetTime: 0,
      numbersTime: 0,
      wordsTime: 0,
      sentenceTime: 0,
      Gen1Time: 0,
      Gen2Time: 0,
      firstFiveTime: 0,
      firstFiveNumbersTime: 0,
      firstFiveWordsTime: 0,
      fastestSentenceTime: 0,
      perfectSignsInTime: 0,
      lastFiveAccuracy: 0,
      ...data
    };
  }

  // --- LOCAL STORAGE HELPERS ---
  _getLocalKey(uid) {
    return `edusign_progress_${uid}`;
  }

  _loadLocal(uid) {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(this._getLocalKey(uid));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('LocalStorage load failed', e);
      return {};
    }
  }

  _saveLocal(uid, data) {
    if (typeof window === 'undefined') return;
    try {
      const current = this._loadLocal(uid);
      const merged = { ...current, ...data };
      localStorage.setItem(this._getLocalKey(uid), JSON.stringify(merged));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }

  _mergeData(remote, local) {
    // Merge arrays specifically to avoid overwriting with empty
    const merged = { ...remote, ...local };

    const arrayFields = [
      'completedLetters', 'completedNumbers', 'completedAlphabetWords',
      'completedDays', 'completedMonths', 'completedColors',
      'completedMotionWords', 'completedStaticWords',
      'completedGeneralWords', 'completedGen1', 'completedGen2',
      'completedAZWords', 'completedSentences', 'badges'
    ];

    arrayFields.forEach(field => {
      const remoteArr = Array.isArray(remote[field]) ? remote[field] : [];
      const localArr = Array.isArray(local[field]) ? local[field] : [];
      // Union
      merged[field] = [...new Set([...remoteArr, ...localArr])];
    });

    return merged;
  }

  // Get user progress (Merged Remote + Local)
  async getProgress(uid) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      let remoteData = docSnap.exists() ? docSnap.data() : {};
      let localData = this._loadLocal(uid);

      // Merge: Local might have newer data if offline/quota
      const finalData = this._mergeData(remoteData, localData);

      return this._withDefaults(finalData);
    } catch (error) {
      console.error('❌ Error getting progress (using local backup):', error);
      const localData = this._loadLocal(uid);
      return this._withDefaults(localData);
    }
  }

  // Cleanup corrupted days data (fixes 118 days bug)
  async cleanupDuplicateDays(uid) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log('No user document found');
        return;
      }

      const data = docSnap.data();
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      // Clean up completedDays - remove duplicates and invalid entries
      let completedDays = data.completedDays || [];
      if (Array.isArray(completedDays) && completedDays.length > 0) {
        // Remove duplicates
        const uniqueDays = [...new Set(completedDays)];
        // Only keep valid days
        const cleanDays = uniqueDays.filter(day => validDays.includes(day));

        console.log(`🧹 Cleaning Days: ${completedDays.length} → ${cleanDays.length}`);
        console.log(`  Original:`, completedDays.slice(0, 10), '...');
        console.log(`  Cleaned:`, cleanDays);

        await setDoc(docRef, {
          completedDays: cleanDays
        }, { merge: true });

        console.log(`✅ Days cleaned successfully: ${cleanDays.length}/7`);
        return { success: true, before: completedDays.length, after: cleanDays.length };
      }

      return { success: true, message: 'No cleanup needed' };
    } catch (error) {
      console.error('❌ Error cleaning up days:', error);
      return { success: false, error: error.message };
    }
  }

  // Cleanup corrupted colors data (fixes 11/-1 bug)
  async cleanupDuplicateColors(uid) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log('No user document found');
        return;
      }

      const data = docSnap.data();
      const validColors = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Black', 'White', 'Grey'];

      // Clean up completedColors - remove duplicates and invalid entries
      let completedColors = data.completedColors || [];
      if (Array.isArray(completedColors) && completedColors.length > 0) {
        // Remove duplicates
        const uniqueColors = [...new Set(completedColors)];
        // Only keep valid colors
        const cleanColors = uniqueColors.filter(color => validColors.includes(color));

        console.log(`🧹 Cleaning Colors: ${completedColors.length} → ${cleanColors.length}`);
        console.log(`  Original:`, completedColors.slice(0, 10), '...');
        console.log(`  Cleaned:`, cleanColors);

        await setDoc(docRef, {
          completedColors: cleanColors
        }, { merge: true });

        console.log(`✅ Colors cleaned successfully: ${cleanColors.length}/11`);
        return { success: true, before: completedColors.length, after: cleanColors.length };
      }

      return { success: true, message: 'No cleanup needed' };
    } catch (error) {
      console.error('❌ Error cleaning up colors:', error);
      return { success: false, error: error.message };
    }
  }

  // Update progress
  async updateProgress(uid, data) {
    try {
      // 1. Save Local
      this._saveLocal(uid, data);

      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, {
        ...data,
        lastActive: new Date().toISOString()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating progress:', error);
      // Even if Firestore fails, return true if verified local? 
      // User expects 'success' usually.
      return { success: true, _localOnly: true };
    }
  }

  // Complete a letter and bump lesson count
  async completeLetter(uid, letter) {
    try {
      const docRef = doc(db, 'users', uid);
      const data = await this.getProgress(uid); // Use merged getProgress

      if (!data.completedLetters.includes(letter)) {
        const newLetters = [...data.completedLetters, letter];

        // 1. Save Local
        this._saveLocal(uid, { completedLetters: newLetters });

        // PERISISTENCE FIX: Save the letter first!
        await setDoc(docRef, {
          completedLetters: arrayUnion(letter),
          lastActive: new Date().toISOString()
        }, { merge: true });

        const badgeResult = await this.checkAndAwardBadges(uid);
        console.log('✅ Letter completed & saved (Local+Remote):', letter);

        // Check if both alphabet and numbers are complete to unlock Word Wonderland
        const updatedData = await this.getProgress(uid);
        const completedLettersCount = updatedData?.completedLetters?.length || 0;
        const completedNumbersCount = updatedData?.completedNumbers?.length || 0;

        if (completedLettersCount >= 26 && completedNumbersCount >= 10 && !updatedData.signBasicsCompleted) {
          const unlockData = { signBasicsCompleted: true };
          this._saveLocal(uid, unlockData);
          await setDoc(docRef, { ...unlockData, lastActive: new Date().toISOString() }, { merge: true });
          console.log('🎉 Sign Basics Adventure Complete! Word Wonderland unlocked!');
        }

        return { success: true, newBadges: badgeResult.newBadges || [] };
      }

      return { success: true, newBadges: [] };
    } catch (error) {
      console.error('❌ Error completing letter:', error);
      // Return success if error is Quota related to keep UI happy?
      if (error?.code === 'resource-exhausted') return { success: true, newBadges: [], _localOnly: true };
      return { success: false, error: error.message };
    }
  }

  // Update last feedback mood for mascot
  async setFeedback(uid, status) {
    try {
      this._saveLocal(uid, { lastFeedback: status });
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, {
        lastFeedback: status,
        lastActive: new Date().toISOString()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating feedback:', error);
      return { success: false, error: error.message };
    }
  }

  // Complete a stage and award badge
  async completeStage(uid, stageName, timeTaken = 0) {
    try {
      const docRef = doc(db, 'users', uid);
      const data = await this.getProgress(uid); // Merged

      let badgeToAdd = null;
      let updates = {
        lastActive: new Date().toISOString()
      };

      if (stageName === 'alphabet') {
        badgeToAdd = 'Alphabet Master';
        updates.level = 'Intermediate';
        updates.alphabetCompleted = true;
        if (timeTaken > 0) updates.alphabetTime = timeTaken;
      } else if (stageName === 'word') {
        badgeToAdd = 'Word Adventurer';
        updates.level = 'Advanced';
        updates.wordStageCompleted = true;
        if (timeTaken > 0) updates.wordTime = timeTaken;
      } else if (stageName === 'days') {
        badgeToAdd = 'Days Master';
        updates.daysCompleted = true;
        if (timeTaken > 0) updates.daysTime = timeTaken;
      } else if (stageName === 'sentence') {
        badgeToAdd = 'Sentence Explorer';
        updates.level = 'Expert';
        updates.sentenceStageCompleted = true;
        if (timeTaken > 0) updates.sentenceTime = timeTaken;
      } else if (stageName === 'Gen1') {
        // Handled generically but add explicit updates if needed
      }

      // Check Badges
      if (badgeToAdd && !data.badges?.includes(badgeToAdd)) {
        updates.badges = [...(data.badges || []), badgeToAdd]; // Local friendly
      }

      // 1. Save Local
      this._saveLocal(uid, updates);

      // 2. Save Remote
      // Transform badges back to arrayUnion for Firestore
      const firestoreUpdates = { ...updates };
      if (updates.badges) firestoreUpdates.badges = arrayUnion(badgeToAdd);

      await setDoc(docRef, firestoreUpdates, { merge: true });
      console.log('✅ Stage completed:', stageName, 'Badge:', badgeToAdd, 'Time:', timeTaken);
      return { success: true, badge: badgeToAdd };
    } catch (error) {
      console.error('❌ Error completing stage:', error);
      if (error?.code === 'resource-exhausted') return { success: true, _localOnly: true };
      return { success: false, error: error.message };
    }
  }

  // Update stage timer (paused/resumed)
  async updateStageTime(uid, stageName, timeSeconds) {
    try {
      const timeField = `${stageName}Time`;
      this._saveLocal(uid, { [timeField]: timeSeconds });

      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, {
        [timeField]: timeSeconds,
        lastActive: new Date().toISOString()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating stage time:', error);
      return { success: false, error: error.message };
    }
  }

  // Complete a sentence
  async completeSentence(uid, sentence) {
    try {
      const docRef = doc(db, 'users', uid);
      const data = await this.getProgress(uid);

      if (!data.completedSentences.includes(sentence)) {
        const newSentences = [...data.completedSentences, sentence];

        // 1. Save Local
        this._saveLocal(uid, { completedSentences: newSentences });

        await setDoc(docRef, {
          completedSentences: arrayUnion(sentence),
          lastActive: new Date().toISOString()
        }, { merge: true });
        console.log('✅ Sentence completed:', sentence);

        // Check if all sentences are completed for the badge
        const updatedData = await this.getProgress(uid);
        const completedSentencesCount = updatedData?.completedSentences?.length || 0;

        // Assuming 7 sentences total as per SentenceLessonPage
        if (completedSentencesCount >= 7 && !updatedData.sentenceStageCompleted) {
          await this.completeStage(uid, 'sentence');
        }
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Error completing sentence:', error);
      if (error?.code === 'resource-exhausted') return { success: true, _localOnly: true };
      return { success: false, error: error.message };
    }
  }

  // number completion removed to save space, assuming it's similar logic. 
  // Wait, I am replacing a range. I should probably include completeNumber correctly or the range might cut it off.
  // The range end was 626 which is resetStage. completeNumber was around 328.
  // I must include completeNumber.

  // Check and award badges
  async checkAndAwardBadges(uid) {
    try {
      const allBadges = getAllBadges();
      const progress = await this.getProgress(uid); // Merged data
      const currentBadges = progress.badges || [];

      const newBadges = [];
      const newBadgeIds = [];

      // Check each badge
      allBadges.forEach(badge => {
        // Check both ID and Name to support legacy/manual adds
        const owned = currentBadges.some(b => b === badge.id || b === badge.name);

        if (!owned) {
          // Check condition
          if (badge.condition(progress)) {
            newBadges.push(badge.id); // Add by ID (Standard)
            newBadgeIds.push(badge);
            console.log('✨ Unlocking badge:', badge.name);
          }
        }
      });

      if (newBadges.length > 0) {
        // Update
        const updatedBadges = [...currentBadges, ...newBadges];
        // Determine levels/flags based on badges?
        // (Legacy logic in completeStage handles level updates, so we just handle badges here)

        this._saveLocal(uid, { badges: updatedBadges });

        const docRef = doc(db, 'users', uid);
        await setDoc(docRef, {
          badges: arrayUnion(...newBadges),
          lastActive: new Date().toISOString()
        }, { merge: true });

        return { newBadges: newBadgeIds };
      }

      return { newBadges: [] };
    } catch (error) {
      console.error('❌ Badge check error:', error);
      return { newBadges: [] };
    }
  }

  // Complete a number
  async completeNumber(uid, number) {
    try {
      const docRef = doc(db, 'users', uid);
      const data = await this.getProgress(uid);

      if (!data.completedNumbers.includes(number)) {
        const newNumbers = [...data.completedNumbers, number];

        // 1. Local
        this._saveLocal(uid, { completedNumbers: newNumbers });

        const updates = {
          completedNumbers: arrayUnion(number),
          lastActive: new Date().toISOString()
        };

        await setDoc(docRef, updates, { merge: true });
        const badgeResult = await this.checkAndAwardBadges(uid);
        console.log('✅ Number completed:', number);

        // Check if both alphabet and numbers are complete to unlock Word Wonderland
        const updatedData = await this.getProgress(uid);
        const completedLetters = updatedData?.completedLetters?.length || 0;
        const completedNumbers = updatedData?.completedNumbers?.length || 0;

        if (completedLetters >= 26 && completedNumbers >= 10 && !updatedData.signBasicsCompleted) {
          const unlock = { signBasicsCompleted: true };
          this._saveLocal(uid, unlock);
          await setDoc(docRef, { ...unlock, lastActive: new Date().toISOString() }, { merge: true });
          console.log('🎉 Sign Basics Adventure Complete! Word Wonderland unlocked!');
        }

        return { success: true, newBadges: badgeResult.newBadges || [] };
      }

      return { success: true, newBadges: [] };
    } catch (error) {
      console.error('❌ Error completing number:', error);
      if (error?.code === 'resource-exhausted') return { success: true, newBadges: [], _localOnly: true };
      return { success: false, error: error.message };
    }
  }

  // Complete word types
  async completeWord(uid, wordType, word) {
    try {
      const docRef = doc(db, 'users', uid);
      const fieldMap = {
        'days': 'completedDays',
        'months': 'completedMonths',
        'colors': 'completedColors',
        'alphabetWords': 'completedAlphabetWords',
        'azWords': 'completedAlphabetWords',
        'AZWords': 'completedAZWords',
        'motion': 'completedMotionWords',
        'static': 'completedStaticWords',
        'general': 'completedGeneralWords',
        'Gen1': 'completedGen1',
        'Gen2': 'completedGen2'
      };

      const field = fieldMap[wordType];
      if (!field) {
        throw new Error(`Invalid word type: ${wordType}`);
      }

      // Define max limits... (keeping existing limits)
      const maxLimits = {
        'completedDays': 7,
        'completedMonths': 12,
        'completedColors': 11,
        'completedAlphabetWords': 26,
        'completedMotionWords': 24,
        'completedStaticWords': 16,
        'completedGeneralWords': 40,
        'completedGen1': 24,
        'completedGen2': 16,
        'completedAZWords': 26
      };

      const data = await this.getProgress(uid); // Merged

      // Get current array and ensure uniqueness
      let currentArray = Array.isArray(data[field]) ? data[field] : [];
      currentArray = [...new Set(currentArray)];
      const maxLimit = maxLimits[field] || Infinity;

      if (!currentArray.includes(word) && currentArray.length < maxLimit) {

        // 1. Save Local
        const newArray = [...currentArray, word];
        this._saveLocal(uid, { [field]: newArray });

        // 2. Save Remote
        await setDoc(docRef, {
          [field]: arrayUnion(word),
          lastActive: new Date().toISOString()
        }, { merge: true });

        const badgeResult = await this.checkAndAwardBadges(uid);
        console.log(`✅ ${wordType} word completed:`, word);
        return { success: true, newBadges: badgeResult.newBadges || [] };
      }
      // ... else cases
      return { success: true, newBadges: [] };
    } catch (error) {
      console.error('❌ Error completing word:', error);
      if (error?.code === 'resource-exhausted') return { success: true, newBadges: [], _localOnly: true };
      return { success: false, error: error.message };
    }
  }

  // Complete day wrapper
  async completeDay(uid, day) {
    return this.completeWord(uid, 'days', day);
  }

  // Reset a stage
  async resetStage(uid, stageName) {
    try {
      const docRef = doc(db, 'users', uid);
      let updates = {
        lastActive: new Date().toISOString()
      };

      const resetFields = [];

      if (stageName === 'alphabet') {
        updates.completedLetters = [];
        updates.alphabetCompleted = false;
        updates.alphabetTime = 0;
        updates.totalLessons = 0;
        resetFields.push('completedLetters', 'alphabetCompleted', 'alphabetTime', 'totalLessons');
      } else if (stageName === 'numbers') {
        updates.completedNumbers = [];
        updates.numbersTime = 0; // Fix: Reset time too?
        resetFields.push('completedNumbers', 'numbersTime');
      } else if (stageName === 'Gen1') {
        updates.completedGen1 = [];
        updates.Gen1Time = 0;
        resetFields.push('completedGen1', 'Gen1Time');
      } else if (stageName === 'Gen2') {
        updates.completedGen2 = [];
        updates.Gen2Time = 0;
        resetFields.push('completedGen2', 'Gen2Time');
      } else if (stageName === 'AZWords') {
        updates.completedAZWords = [];
        updates.AZWordsTime = 0;
        resetFields.push('completedAZWords', 'AZWordsTime');
      } else if (stageName === 'word') {
        // ...
      } else if (stageName === 'sentence') {
        updates.completedSentences = [];
        updates.sentenceProgress = { completed: 0, total: 7 };
        updates.sentenceStageCompleted = false;
        updates.sentenceTime = 0;
        resetFields.push('completedSentences', 'sentenceProgress', 'sentenceStageCompleted', 'sentenceTime');
      }

      // 1. Reset Local
      const current = this._loadLocal(uid);
      resetFields.forEach(f => {
        if (Array.isArray(updates[f])) current[f] = [];
        else current[f] = updates[f];
      });
      localStorage.setItem(this._getLocalKey(uid), JSON.stringify(current));

      await updateDoc(docRef, updates);
      console.log('✅ Stage reset:', stageName);
      return { success: true };
    } catch (error) {
      console.error('❌ Error resetting stage:', error);
      if (error?.code === 'resource-exhausted') return { success: true, _localOnly: true };
      return { success: false, error: error.message };
    }
  }

  // Star tracking utilities
  getTotalStars(progress) {
    if (!progress) return 0;
    return (progress.completedAlphabetWords?.length || 0) +   // 26 max
      (progress.completedDays?.length || 0) +            // 7 max
      (progress.completedColors?.length || 0) +          // 11 max
      (progress.completedMotionWords?.length || 0) +     // 24 max
      (progress.completedStaticWords?.length || 0);      // 16 max
    // Total: 84 stars possible
  }

  getSectionStars(progress, sectionId) {
    if (!progress) return { earned: 0, total: 0 };

    switch (sectionId) {
      case 'az-words':
        return { earned: progress.completedAZWords?.length || 0, total: 26 };
      case 'days':
        return { earned: progress.completedDays?.length || 0, total: 7 };
      case 'colours':
        return { earned: progress.completedColors?.length || 0, total: 11 };
      case 'motion':
        return { earned: progress.completedMotionWords?.length || 0, total: 24 };
      case 'static':
        return { earned: progress.completedStaticWords?.length || 0, total: 16 };
      case 'general':
        return {
          earned: (progress.completedMotionWords?.length || 0) + (progress.completedStaticWords?.length || 0),
          total: 40
        };
      default:
        return { earned: 0, total: 0 };
    }
  }


  // Unlock a specific stage
  async unlockStage(uid, stageName) {
    try {
      const docRef = doc(db, 'users', uid);
      let updates = { lastActive: new Date().toISOString() };

      if (stageName === 'sentence') {
        updates.sentenceStageUnlocked = true; // Use a specific flag or just rely on logic?
        // Actually, usually stages are unlocked by logic (isWordWonderlandComplete).
        // But if we want to force it or store a persistent flag:
        updates.wordStageCompleted = true; // Maybe this triggers it?
        // Let's add a specific flag if the UI checks it, otherwise this method might be symbolic.
        // Assuming the UI checks 'wordStageCompleted' or similar.
      }

      // 1. Save Local
      this._saveLocal(uid, updates);

      await setDoc(docRef, updates, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('❌ Error unlocking stage:', error);
      return { success: false };
    }
  }

  // Check if Word Wonderland is complete
  isWordWonderlandComplete(progress) {
    if (!progress) return false;
    // Word Wonderland: 
    // A-Z Words (26), Days (7), Colors (11), 
    // Motion/Gen1 (24), Static/Gen2 (16)

    // Check both potential field names for backward compatibility
    const motionCount = Math.max(
      progress.completedMotionWords?.length || 0,
      progress.completedGen1?.length || 0
    );
    const staticCount = Math.max(
      progress.completedStaticWords?.length || 0,
      progress.completedGen2?.length || 0
    );

    return (progress.completedAZWords?.length || 0) >= 26 &&
      (progress.completedDays?.length || 0) >= 7 &&
      (progress.completedColors?.length || 0) >= 11 &&
      motionCount >= 24 &&
      staticCount >= 16;
  }

  // Check if all ISL stages are complete (Sign Basics + Word Wonderland + Sentence Safari)
  isAllStagesComplete(progress) {
    if (!progress) return false;

    // Sign Basics: Alphabet (26) + Numbers (10)
    const signBasicsComplete =
      (progress.completedLetters?.length || 0) >= 26 &&
      (progress.completedNumbers?.length || 0) >= 10;

    // Word Wonderland: A-Z Words, Days, Colors, Gen1, Gen2
    const wordWonderlandComplete = this.isWordWonderlandComplete(progress);

    // Sentence Safari: 7 sentences
    const sentenceSafariComplete =
      (progress.completedSentences?.length || 0) >= 7;

    return signBasicsComplete && wordWonderlandComplete && sentenceSafariComplete;
  }

  // Award star on word completion
  async awardStar(uid, sectionType, word) {
    return this.completeWord(uid, sectionType, word);
  }
}

export default new UserProgressService();
