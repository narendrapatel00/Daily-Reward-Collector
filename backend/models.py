from datetime import datetime
from database import db, encrypt_password, decrypt_password

class Account(db.Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(150), nullable=False)
    encrypted_password = db.Column(db.String(500), nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to logs
    logs = db.relationship('Log', backref='account', lazy=True, cascade="all, delete-orphan")

    def __init__(self, name, username, password, enabled=True):
        self.name = name
        self.username = username
        self.password = password  # Uses the setter
        self.enabled = enabled

    @property
    def password(self):
        """Getter that decrypts the password when accessed."""
        return decrypt_password(self.encrypted_password)

    @password.setter
    def password(self, plain_password):
        """Setter that encrypts the password before saving."""
        self.encrypted_password = encrypt_password(plain_password)

    def serialize(self, include_password=False):
        """Serializes the model to a dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'username': self.username,
            'enabled': self.enabled,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_password:
            data['password'] = self.password
        return data


class Log(db.Model):
    __tablename__ = 'logs'

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True)
    account_name = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    reward_name = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(20), nullable=False)  # 'Success' or 'Failed'
    error_message = db.Column(db.Text, nullable=True)

    def serialize(self):
        """Serializes the log model to a dictionary."""
        return {
            'id': self.id,
            'account_id': self.account_id,
            'account_name': self.account_name,
            'timestamp': self.timestamp.isoformat(),
            'reward_name': self.reward_name,
            'status': self.status,
            'error_message': self.error_message
        }
