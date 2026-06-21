import os
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, make_response, render_template_string, session, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO

from database import db
from models import Account, Log
from scheduler import start_scheduler, trigger_collection_now, trigger_all_collections_now

# Initialize Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'daily-reward-collector-secret-key-123')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///daily_rewards.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Enable CORS (allow dev port of Vite frontend)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Initialize Flask-SocketIO (using native threading for robust Selenium execution)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Initialize DB
db.init_app(app)

# Track claimed states for the Mock Website
mock_claims = {}

# ----------------- Database Setup & Scheduler Startup -----------------
with app.app_context():
    db.create_all()
    # Check if there's any active account, if so start scheduler
    start_scheduler()

@app.route('/')
def home():
    return jsonify({
        "project": "Daily Reward Collector",
        "status": "Running",
        "mode": os.getenv('BOT_MODE', 'simulation').lower()
    })

# ----------------- Account API Endpoints -----------------
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    accounts = Account.query.all()
    return jsonify([a.serialize() for a in accounts])

@app.route('/api/accounts', methods=['POST'])
def add_account():
    data = request.json
    if not data or not data.get('name') or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Missing required fields"}), 400
        
    # Check if account already exists
    existing = Account.query.filter_by(username=data['username']).first()
    if existing:
        return jsonify({"error": "Account with this username already exists"}), 400

    account = Account(
        name=data['name'],
        username=data['username'],
        password=data['password'],
        enabled=data.get('enabled', True)
    )
    db.session.add(account)
    db.session.commit()
    return jsonify(account.serialize()), 201

@app.route('/api/accounts/<int:account_id>', methods=['PUT'])
def update_account(account_id):
    account = Account.query.get_or_404(account_id)
    data = request.json
    if not data:
        return jsonify({"error": "Missing parameters"}), 400

    if 'name' in data:
        account.name = data['name']
    if 'username' in data:
        account.username = data['username']
    if 'password' in data and data['password']:
        account.password = data['password']
    if 'enabled' in data:
        account.enabled = data['enabled']

    db.session.commit()
    return jsonify(account.serialize())

@app.route('/api/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    account = Account.query.get_or_404(account_id)
    db.session.delete(account)
    db.session.commit()
    return jsonify({"message": f"Account {account_id} deleted successfully"})

# ----------------- Reward Collection API Endpoints -----------------
@app.route('/api/collect/<int:account_id>', methods=['POST'])
def collect_now(account_id):
    success, message = trigger_collection_now(account_id)
    if success:
        return jsonify({"status": "queued", "message": message}), 202
    else:
        return jsonify({"error": message}), 400

@app.route('/api/collect/all', methods=['POST'])
def collect_all_now():
    success, message = trigger_all_collections_now()
    if success:
        return jsonify({"status": "queued", "message": message}), 202
    else:
        return jsonify({"error": message}), 400

# ----------------- Log API Endpoints & CSV Export -----------------
@app.route('/api/logs', methods=['GET'])
def get_logs():
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    account_id = request.args.get('account_id', '')
    export = request.args.get('export', '')

    query = Log.query

    # Apply filters
    if search:
        query = query.filter(
            db.or_(
                Log.account_name.ilike(f'%{search}%'),
                Log.reward_name.ilike(f'%{search}%'),
                Log.error_message.ilike(f'%{search}%')
            )
        )
    if status:
        query = query.filter(Log.status == status)
    if account_id:
        query = query.filter(Log.account_id == int(account_id))

    # Order newest first
    query = query.order_by(Log.timestamp.desc())

    # Export to CSV if requested
    if export == 'csv':
        logs = query.all()
        si = io.StringIO()
        cw = csv.writer(si)
        # Header
        cw.writerow(['Log ID', 'Account Name', 'Timestamp', 'Reward Collected', 'Status', 'Error Message'])
        for log in logs:
            cw.writerow([
                log.id,
                log.account_name,
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.reward_name or 'N/A',
                log.status,
                log.error_message or 'N/A'
            ])
        output = make_response(si.getvalue())
        output.headers["Content-Disposition"] = "attachment; filename=daily_rewards_logs.csv"
        output.headers["Content-type"] = "text/csv"
        return output

    # Pagination for UI
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'logs': [log.serialize() for log in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev
    })

# ----------------- Stats & Dashboard Endpoints -----------------
@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_runs = Log.query.count()
    total_success = Log.query.filter_by(status='Success').count()
    total_failed = Log.query.filter_by(status='Failed').count()
    
    # Success rate
    success_rate = (total_success / total_runs * 100) if total_runs > 0 else 0
    
    # Collections today
    today_start = datetime.combine(datetime.now().date(), datetime.min.time())
    today_success = Log.query.filter(
        Log.status == 'Success',
        Log.timestamp >= today_start
    ).count()

    # Collections historical chart data (past 7 days)
    chart_data = []
    for i in range(6, -1, -1):
        target_date = datetime.now().date() - timedelta(days=i)
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())
        
        success_count = Log.query.filter(
            Log.status == 'Success',
            Log.timestamp >= day_start,
            Log.timestamp <= day_end
        ).count()
        
        failed_count = Log.query.filter(
            Log.status == 'Failed',
            Log.timestamp >= day_start,
            Log.timestamp <= day_end
        ).count()

        chart_data.append({
            'date': target_date.strftime('%b %d'),
            'success': success_count,
            'failed': failed_count
        })

    return jsonify({
        'summary': {
            'total_collected': total_success,
            'today_collected': today_success,
            'failed_attempts': total_failed,
            'success_rate': round(success_rate, 1)
        },
        'chart_data': chart_data
    })

# ----------------- WebSocket Events -----------------
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")


# ----------------- Local Mock Game Website (Selenium Target) -----------------
LOGIN_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Mock Game Portal - Login</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f0f12; color: #f3f4f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1f1f23; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #2d2d34; width: 340px; }
        h2 { margin-top: 0; margin-bottom: 1.5rem; text-align: center; color: #a78bfa; font-weight: 700; }
        .input-group { margin-bottom: 1.25rem; }
        label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #9ca3af; }
        input { width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid #374151; background: #111827; color: #fff; box-sizing: border-box; font-size: 1rem; }
        input:focus { border-color: #8b5cf6; outline: none; }
        button { width: 100%; padding: 0.75rem; border: none; background: #7c3aed; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 1rem; transition: background 0.2s; }
        button:hover { background: #6d28d9; }
        .error { color: #ef4444; background: #fee2e2; border: 1px solid #fca5a5; padding: 0.75rem; border-radius: 6px; font-size: 0.875rem; margin-bottom: 1.25rem; text-shadow: none; color: #b91c1c; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Game Login</h2>
        {% if error %}
        <div id="error-msg" class="error">{{ error }}</div>
        {% endif %}
        <form method="POST" action="/mock-site/login">
            <div class="input-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="input-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" id="login-btn">Sign In</button>
        </form>
    </div>
</body>
</html>
"""

DASHBOARD_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Mock Game Portal - Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f0f12; color: #f3f4f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1f1f23; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #2d2d34; text-align: center; width: 420px; }
        h2 { margin-top: 0; color: #a78bfa; }
        p { color: #9ca3af; font-size: 1rem; }
        button { padding: 1rem 2rem; border: none; background: #10b981; color: #064e3b; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 1.1rem; margin-top: 1.5rem; transition: background 0.2s; width: 100%; }
        button:hover { background: #34d399; }
        button.disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .reward { margin-top: 1.5rem; font-size: 1.3rem; color: #f59e0b; font-weight: 800; border: 2px dashed #f59e0b; padding: 0.75rem; border-radius: 6px; background: rgba(245, 158, 11, 0.1); }
        .logout { display: inline-block; margin-top: 1.5rem; color: #8b5cf6; text-decoration: none; font-weight: 500; }
        .logout:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Welcome to Game Portal!</h2>
        <p>Logged in as: <strong>{{ username }}</strong></p>
        
        <form method="POST" action="/mock-site/claim">
            <input type="hidden" name="username" value="{{ username }}">
            {% if claimed %}
            <button type="button" class="disabled" disabled>Claimed Today</button>
            <div id="reward-details" class="reward">{{ reward }}</div>
            {% else %}
            <button type="submit" id="claim-btn">Claim Daily Reward</button>
            {% endif %}
        </form>
        <a href="/mock-site/logout" class="logout">Logout</a>
    </div>
</body>
</html>
"""

@app.route('/mock-site/login', methods=['GET', 'POST'])
def mock_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            return render_template_string(LOGIN_HTML, error="Please fill all fields")
        
        # Simple simulation: Allow any user, but check for dummy invalid credentials
        if password == "wrongpassword":
            return render_template_string(LOGIN_HTML, error="Invalid password")
            
        session['username'] = username
        return redirect(url_for('mock_dashboard'))
        
    return render_template_string(LOGIN_HTML, error=None)

@app.route('/mock-site/dashboard')
def mock_dashboard():
    username = session.get('username')
    if not username:
        return redirect(url_for('mock_login'))
        
    # Check if this user claimed today
    today_str = datetime.now().strftime('%Y-%m-%d')
    user_claim_key = f"{username}_{today_str}"
    
    claimed = user_claim_key in mock_claims
    reward = mock_claims.get(user_claim_key)
    
    return render_template_string(DASHBOARD_HTML, username=username, claimed=claimed, reward=reward)

@app.route('/mock-site/claim', methods=['POST'])
def mock_claim():
    username = request.form.get('username') or session.get('username')
    if not username:
        return redirect(url_for('mock_login'))
        
    today_str = datetime.now().strftime('%Y-%m-%d')
    user_claim_key = f"{username}_{today_str}"
    
    rewards = ["100 Gold Coins", "Daily XP Boost (2hrs)", "5x Crafting Materials", "Rare Chest Key", "50 Gems"]
    reward = random.choice(rewards)
    
    # Store claim
    mock_claims[user_claim_key] = reward
    
    return render_template_string(DASHBOARD_HTML, username=username, claimed=True, reward=reward)

@app.route('/mock-site/logout')
def mock_logout():
    session.pop('username', None)
    return redirect(url_for('mock_login'))


# ----------------- Start Server -----------------
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
