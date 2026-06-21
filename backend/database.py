import os
from flask_sqlalchemy import SQLAlchemy
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Initialize SQLAlchemy
db = SQLAlchemy()

# Load environment variables
load_dotenv()

# Setup encryption key
ENCRYPTION_KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')

def get_or_create_encryption_key():
    """Retrieves the encryption key from environment or generates a new one."""
    key = os.getenv('ENCRYPTION_KEY')
    if not key:
        # Generate new key
        key = Fernet.generate_key().decode()
        # Ensure directory exists and append to .env
        os.makedirs(os.path.dirname(ENCRYPTION_KEY_PATH), exist_ok=True)
        with open(ENCRYPTION_KEY_PATH, 'a+') as f:
            f.seek(0)
            content = f.read()
            if 'ENCRYPTION_KEY=' not in content:
                f.write(f"\nENCRYPTION_KEY={key}\n")
    return key.encode()

# Initialize cipher suite
try:
    cipher_suite = Fernet(get_or_create_encryption_key())
except Exception as e:
    # Fallback to a temporary runtime key in case of error (not recommended for production persistence)
    print(f"Error initializing cipher suite: {e}. Generating a temporary runtime key.")
    cipher_suite = Fernet(Fernet.generate_key())

def encrypt_password(password: str) -> str:
    """Encrypts a plain text password to a secure string."""
    if not password:
        return ""
    return cipher_suite.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    """Decrypts an encrypted password string back to plain text."""
    if not encrypted_password:
        return ""
    try:
        return cipher_suite.decrypt(encrypted_password.encode()).decode()
    except Exception as e:
        print(f"Failed to decrypt password: {e}")
        return ""
