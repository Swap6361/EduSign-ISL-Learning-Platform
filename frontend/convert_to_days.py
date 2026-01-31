import sys
import re

with open('src/pages/LessonPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Systematic replacements
replacements = [
    # Component and imports
    ('const LessonPage', 'const DaysLessonPage'),
    ('export default LessonPage', 'export default DaysLessonPage'),
    ("from '../services/predictionService'", "from '../services/predictionServiceDays'"),
    ('import { useNavigate, useLocation }', 'import { useNavigate }'),
    ('const location = useLocation();', ''),
    ("const { stage } = location.state || { stage: 'beginner' };", ''),
    
    # Data arrays
    ("const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');", "const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];"),
    
    # Variable names
    ('alphabet\\.length', 'days.length'),
    ('alphabet\\[', 'days['),
    ('completedLetters', 'completedDays'),
    ('currentLetterIndex', 'currentDayIndex'),
    ('currentLetter', 'currentDay'),
    ('advanceToNextLetterRef', 'advanceToNextDayRef'),
    ('persistLetterCompletionRef', 'persistDayCompletionRef'),
    ('advanceToNextLetter', 'advanceToNextDay'),
    ('persistLetterCompletion', 'persistDayCompletion'),
    ('goToLetter', 'goToDay'),
    ('skipLetter', 'skipDay'),
    ('prevLetter', 'prevDay'),
    ('completeDay\\(', 'completeWord('),
    
    # Threshold
    ('CONFIDENCE_THRESHOLD = 0.65', 'CONFIDENCE_THRESHOLD = 0.60'),
    
    # UI Text
    ('Alphabet Island', 'Days of the Week'),
    ('🏝 Days of the Week', '📅 Days of the Week'),
    ('All 26 Letters', 'All 7 Days'),
    (' days completed', ' days completed'),
    ('Choose a day', 'Choose a Day'),
    ('Letter completed', 'Day completed'),
    ('Days Mastered', 'Days Mastered'),
    ('all days', 'all days'),
    
    # Firebase/progress
    ("'alphabet'", "'days'"),
    ('alphabetTime', 'daysTime'),
    ('alphabetCompleted', 'daysCompleted'),
    
    # Service reference
    ('predictionService\\.', 'predictionServiceDays.'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

# Replace day tips manually
tips_old = '''const dayTips = {
    'A': ['Make a fist', 'Thumb points up', 'Keep fingers closed'],'''

tips_new = '''const dayTips = {
    'Monday': ['Start of week', 'M handshape', 'Move in small circle'],
    'Tuesday': ['Second day', 'T handshape', 'Move upward'],
    'Wednesday': ['Mid-week', 'W handshape', 'Small rotation'],
    'Thursday': ['Fourth day', 'TH fingerspelling', 'Move forward'],
    'Friday': ['End of work week', 'F handshape', 'Circle motion'],
    'Saturday': ['Weekend starts', 'S handshape', 'Move in arc'],
    'Sunday': ['Rest day', 'Flat hands', 'Move apart']'''

# Find letterTips section and replace
pattern = r'const \w+Tips = \{[^}]+\};'
if 'letterTips' in content or 'dayTips' in content:
    content = re.sub(r'const \w+Tips = \{.*?\};', tips_new + '\n  };', content, flags=re.DOTALL, count=1)

with open('src/pages/DaysLessonPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
