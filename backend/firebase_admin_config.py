import firebase_admin
from firebase_admin import credentials, auth, firestore
import os
import logging

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
def initialize_firebase():
    if not firebase_admin._apps:
        try:
            # Path to your service account key (the JSON file you placed in backend folder)
            cred = credentials.Certificate('serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            logger.info("✅ Firebase Admin SDK initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firebase Admin: {e}")
            raise
    
    return firestore.client()

# Verify Firebase ID token from frontend
def verify_token(id_token):
    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        return {'success': True, 'uid': uid, 'user': decoded_token}
    except Exception as e:
        logger.error(f"❌ Token verification failed: {e}")
        return {'success': False, 'error': str(e)}

# Get or create user profile in Firestore
def get_user_profile(uid):
    try:
        db = firestore.client()
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            return user_doc.to_dict()
        else:
            # Create default profile for new user
            default_profile = {
                'uid': uid,
                'level': 'Beginner',
                'completedLetters': [],
                'badges': ['🎉 Welcome Badge'],
                'streak': 0,
                'totalLessons': 0,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'lastActive': firestore.SERVER_TIMESTAMP
            }
            user_ref.set(default_profile)
            logger.info(f"✅ Created new user profile: {uid}")
            return default_profile
    except Exception as e:
        logger.error(f"❌ Error getting user profile: {e}")
        return None

# Update user progress
def update_user_progress(uid, data):
    try:
        db = firestore.client()
        user_ref = db.collection('users').document(uid)
        data['lastActive'] = firestore.SERVER_TIMESTAMP
        user_ref.update(data)
        logger.info(f"✅ Updated user progress: {uid}")
        return {'success': True}
    except Exception as e:
        logger.error(f"❌ Error updating progress: {e}")
        return {'success': False, 'error': str(e)}

# Complete a letter
def complete_letter(uid, letter):
    try:
        db = firestore.client()
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            data = user_doc.to_dict()
            completed = data.get('completedLetters', [])
            
            if letter not in completed:
                completed.append(letter)
                user_ref.update({
                    'completedLetters': completed,
                    'totalLessons': len(completed),
                    'lastActive': firestore.SERVER_TIMESTAMP
                })
                logger.info(f"✅ User {uid} completed letter: {letter}")
        
        return {'success': True}
    except Exception as e:
        logger.error(f"❌ Error completing letter: {e}")
        return {'success': False, 'error': str(e)}