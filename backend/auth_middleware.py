from functools import wraps
from flask import request, jsonify
from firebase_admin_config import verify_token

def require_auth(f):
    """Decorator to protect Flask routes with Firebase auth"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header.split('Bearer ')[1]
        result = verify_token(token)
        
        if not result['success']:
            return jsonify({'error': 'Invalid token', 'details': result.get('error')}), 401
        
        # Add user info to request
        request.user = result['user']
        request.uid = result['uid']
        return f(*args, **kwargs)
    
    return decorated_function