import os
import time
import random
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from database import db
from models import Account, Log

# Fallback/dynamic import for socketio to avoid circular dependencies
def get_socketio():
    try:
        from app import socketio
        return socketio
    except ImportError:
        return None

def emit_status_log(message, account_name=None, status="info"):
    """Emits log messages in real-time to the frontend via Socket.IO."""
    socketio = get_socketio()
    if socketio:
        socketio.emit('bot_log', {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'account_name': account_name or "System",
            'message': message,
            'status': status
        })
    print(f"[{account_name or 'System'}] [{status.upper()}] {message}")

def run_simulation(account, target_url):
    """Simulates the reward collection process without needing Chrome/Selenium."""
    account_name = account.name
    emit_status_log("Starting Daily Reward Collection (SIMULATION MODE)", account_name, "info")
    time.sleep(1.5)
    
    emit_status_log(f"Navigating to login page: {target_url}/login", account_name, "info")
    time.sleep(1.5)
    
    emit_status_log(f"Entering credentials for username: {account.username}", account_name, "info")
    time.sleep(1.0)
    
    emit_status_log("Clicking 'Sign In'...", account_name, "info")
    time.sleep(1.5)
    
    # Simulate a login check (could fail simulated accounts with special names)
    if "fail_login" in account.username.lower():
        emit_status_log("Login failed: Invalid credentials (simulated)", account_name, "error")
        return False, "Invalid credentials (simulated)"

    emit_status_log("Login successful! Redirected to rewards dashboard.", account_name, "info")
    time.sleep(1.5)
    
    emit_status_log("Searching for daily check-in button...", account_name, "info")
    time.sleep(1.0)
    
    if "fail_collect" in account.username.lower():
        emit_status_log("Error: 'Collect' button not clickable (simulated)", account_name, "error")
        return False, "Failed to click collect button"

    emit_status_log("Clicking 'Collect Daily Reward' button...", account_name, "info")
    time.sleep(2.0)
    
    rewards = ["100 Gold Coins", "Daily XP Boost (2hrs)", "5x Crafting Materials", "Rare Chest Key", "50 Gems"]
    reward = random.choice(rewards)
    
    emit_status_log(f"Success! Reward collected: {reward}", account_name, "success")
    return True, reward

def run_selenium(account, target_url):
    """Executes real Selenium browser automation against the mock site or target website."""
    account_name = account.name
    driver = None
    try:
        emit_status_log("Setting up headless Chrome browser...", account_name, "info")
        
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")  # Run in headless mode
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        
        # Initialize Chrome Driver using Selenium Manager (built-in for Selenium 4)
        driver = webdriver.Chrome(options=chrome_options)
        
        # Set viewport size
        driver.set_window_size(1280, 800)
        
        # 1. Navigate to login page
        login_url = f"{target_url.rstrip('/')}/mock-site/login"
        emit_status_log(f"Navigating to: {login_url}", account_name, "info")
        driver.get(login_url)
        
        # Wait for page to load
        wait = WebDriverWait(driver, 10)
        username_input = wait.until(EC.presence_of_element_located((By.ID, "username")))
        password_input = driver.find_element(By.ID, "password")
        login_btn = driver.find_element(By.ID, "login-btn")
        
        # 2. Login
        emit_status_log(f"Entering username: {account.username}", account_name, "info")
        username_input.clear()
        username_input.send_keys(account.username)
        
        emit_status_log("Entering password...", account_name, "info")
        password_input.clear()
        password_input.send_keys(account.password)
        
        time.sleep(0.5)  # Slight human-like delay
        emit_status_log("Submitting login form...", account_name, "info")
        login_btn.click()
        
        # 3. Check for login errors or redirect
        time.sleep(1.5)
        current_url = driver.current_url
        if "error" in current_url or "login" in current_url:
            # Check if there is an error message on screen
            try:
                error_el = driver.find_element(By.ID, "error-msg")
                err_text = error_el.text
            except Exception:
                err_text = "Login redirection failed"
            emit_status_log(f"Login failed: {err_text}", account_name, "error")
            return False, f"Login failed: {err_text}"
            
        emit_status_log("Successfully logged in! Navigated to rewards page.", account_name, "info")
        
        # 4. Click Reward button
        emit_status_log("Waiting for 'Claim Reward' button...", account_name, "info")
        claim_btn = wait.until(EC.element_to_be_clickable((By.ID, "claim-btn")))
        
        # Check if already claimed
        if "disabled" in claim_btn.get_attribute("class") or claim_btn.get_property("disabled"):
            emit_status_log("Daily reward was already claimed today.", account_name, "warning")
            return True, "Already Claimed Today"
            
        emit_status_log("Clicking 'Claim Reward' button...", account_name, "info")
        claim_btn.click()
        
        # 5. Extract reward details
        time.sleep(2.0)
        reward_details_el = wait.until(EC.presence_of_element_located((By.ID, "reward-details")))
        reward_text = reward_details_el.text
        
        emit_status_log(f"Daily reward collected successfully: {reward_text}", account_name, "success")
        return True, reward_text

    except Exception as e:
        error_msg = str(e).split('\n')[0]  # Get first line of traceback
        emit_status_log(f"Selenium automation error: {error_msg}", account_name, "error")
        return False, f"Automation error: {error_msg}"
        
    finally:
        if driver:
            try:
                driver.quit()
                emit_status_log("Browser instance closed.", account_name, "info")
            except Exception:
                pass

def collect_daily_reward(account_id, max_retries=3):
    """
    Orchestrates the login and collection process for a specific account.
    Handles retries and saves execution logs to database.
    """
    # Create application context since database is needed
    from app import app
    with app.app_context():
        account = Account.query.get(account_id)
        if not account:
            emit_status_log(f"Account ID {account_id} not found.", "System", "error")
            return
            
        if not account.enabled:
            emit_status_log(f"Account {account.name} is disabled. Skipping.", "System", "warning")
            return

        bot_mode = os.getenv('BOT_MODE', 'simulation').lower()
        target_url = os.getenv('TARGET_URL', 'http://localhost:5000')

        success = False
        reward_name = None
        error_message = None
        
        for attempt in range(1, max_retries + 1):
            emit_status_log(f"Attempt {attempt} of {max_retries}...", account.name, "info")
            
            try:
                if bot_mode == 'selenium':
                    success, result = run_selenium(account, target_url)
                else:
                    success, result = run_simulation(account, target_url)
                
                if success:
                    reward_name = result
                    break
                else:
                    error_message = result
            except Exception as e:
                error_message = str(e)
                emit_status_log(f"Exception during collection: {error_message}", account.name, "error")
            
            if attempt < max_retries:
                wait_time = 5 * attempt
                emit_status_log(f"Retrying in {wait_time} seconds...", account.name, "warning")
                time.sleep(wait_time)
        
        # Log to Database
        log = Log(
            account_id=account.id,
            account_name=account.name,
            status="Success" if success else "Failed",
            reward_name=reward_name if success else None,
            error_message=None if success else error_message,
            timestamp=datetime.utcnow()
        )
        db.session.add(log)
        db.session.commit()
        
        # Emit event to notify dashboard stats refresh
        socketio = get_socketio()
        if socketio:
            socketio.emit('stats_update', {'refresh': True})
            socketio.emit('new_log', log.serialize())

        return success
