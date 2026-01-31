"""
User Progress and Reward Schema for ASL Learning
"""

class UserProgress:
    """Track user progress across all learning stages"""
    
    def __init__(self, user_id):
        self.user_id = user_id
        self.stages = {
            'alphabet_beginner': {
                'completed': False,
                'progress': 0,  # 0-100
                'letters_learned': [],  # List of completed letters
                'total_letters': 26,
                'stars': 0,  # Max 3 stars per stage
                'reward': None,  # 🎩 Hat
                'avatar_unlocked': 'mascot_hat.png',
                'completed_date': None
            },
            'word_jungle': {
                'completed': False,
                'progress': 0,  # 0-100
                'words_learned': [],  # List of completed words
                'total_words': 0,  # Dynamic
                'stars': 0,  # Max 3 stars per stage
                'reward': None,  # 😎 Glasses
                'avatar_unlocked': 'mascot_glass.png',
                'completed_date': None
            },
            'sentence_master': {
                'completed': False,
                'progress': 0,  # 0-100
                'sentences_learned': [],  # List of completed sentences
                'total_sentences': 0,  # Dynamic
                'stars': 0,  # Max 3 stars per stage
                'reward': None,  # 🏆 Trophy
                'avatar_unlocked': 'mascot_expert.png',
                'completed_date': None
            }
        }
        
        self.avatars = {
            'current': 'mascot.png',  # Default mascot
            'unlocked': ['mascot.png'],  # Available avatars
            'current_mood': 'neutral'  # neutral, excited, sad
        }
        
        self.total_rewards = 0
        self.total_stars = 0
        self.milestone_achieved = None

    def to_dict(self):
        """Convert to dictionary for Firebase"""
        return {
            'user_id': self.user_id,
            'stages': self.stages,
            'avatars': self.avatars,
            'total_rewards': self.total_rewards,
            'total_stars': self.total_stars,
            'milestone_achieved': self.milestone_achieved
        }

class RewardSystem:
    """Manage rewards and badges"""
    
    REWARDS = {
        'alphabet_beginner': {
            'name': '🎩 Hat Reward',
            'icon': 'hat.png',
            'description': 'Mastered all 26 letters!',
            'avatar': 'mascot_hat.png'
        },
        'word_jungle': {
            'name': '😎 Glasses Reward',
            'icon': 'glasses.png',
            'description': 'Completed Word Jungle!',
            'avatar': 'mascot_glass.png'
        },
        'sentence_master': {
            'name': '🏆 Trophy Reward',
            'icon': 'trophy.png',
            'description': 'Mastered Sentences!',
            'avatar': 'mascot_expert.png'
        }
    }
    
    STAR_THRESHOLDS = {
        1: 0.33,    # 1 star at 33%
        2: 0.66,    # 2 stars at 66%
        3: 1.0      # 3 stars at 100%
    }
    
    @staticmethod
    def calculate_stars(progress):
        """Calculate stars based on progress (0-100)"""
        normalized = progress / 100
        for stars in [3, 2, 1]:
            if normalized >= RewardSystem.STAR_THRESHOLDS[stars]:
                return stars
        return 0
    
    @staticmethod
    def get_reward(stage):
        """Get reward details for stage"""
        return RewardSystem.REWARDS.get(stage, None)

class MoodSystem:
    """Manage avatar mood based on performance"""
    
    MOODS = {
        'neutral': 'mascot.png',
        'excited': 'mascot_excited.png',
        'sad': 'mascot_sad.png'
    }
    
    @staticmethod
    def get_mood_avatar(current_avatar, mood):
        """Get avatar with mood"""
        base = current_avatar.replace('.png', '')
        if mood == 'excited':
            return f'{base}_excited.png'
        elif mood == 'sad':
            return f'{base}_sad.png'
        return current_avatar