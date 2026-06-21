from datetime import datetime, date
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from selenium_bot import collect_daily_reward, emit_status_log
from models import Account, Log

# Configure executors: APScheduler uses thread pools to handle concurrent jobs
executors = {
    'default': ThreadPoolExecutor(max_workers=5)
}

scheduler = BackgroundScheduler(executors=executors)

def daily_rewards_job():
    """Runs automatically every day to collect rewards for all enabled accounts."""
    from app import app
    with app.app_context():
        emit_status_log("Daily Scheduler triggered automated reward collection.", "System", "info")
        enabled_accounts = Account.query.filter_by(enabled=True).all()
        
        if not enabled_accounts:
            emit_status_log("No enabled accounts found. Scheduler idle.", "System", "info")
            return
            
        for account in enabled_accounts:
            # Check if already successfully collected today (in local timezone)
            today_start = datetime.combine(date.today(), datetime.min.time())
            already_collected = Log.query.filter(
                Log.account_id == account.id,
                Log.status == "Success",
                Log.timestamp >= today_start
            ).first()
            
            if already_collected:
                emit_status_log(f"Account '{account.name}' already collected a reward today. Skipping scheduler run.", "System", "info")
                continue
                
            # Queue the job in the background to execute
            scheduler.add_job(
                collect_daily_reward,
                trigger='date',
                run_date=datetime.now(),
                args=[account.id],
                id=f"auto_collect_{account.id}_{int(datetime.now().timestamp())}",
                name=f"Auto Collect for {account.name}"
            )
            emit_status_log(f"Queued daily collection job for '{account.name}'.", "System", "info")

def start_scheduler():
    """Starts the background scheduler and registers the daily job."""
    if not scheduler.running:
        scheduler.start()
        emit_status_log("Background scheduler started successfully.", "System", "info")
        
        # Schedule the daily collector to run every day at 00:01 AM
        scheduler.add_job(
            daily_rewards_job,
            trigger='cron',
            hour=0,
            minute=1,
            id='daily_rewards_collection_job',
            replace_existing=True
        )
        emit_status_log("Registered daily cron job at 00:01 AM.", "System", "info")

def trigger_collection_now(account_id):
    """Queues a single manual collection job to run immediately in the background."""
    from app import app
    with app.app_context():
        account = Account.query.get(account_id)
        if not account:
            return False, "Account not found"
            
        # Add one-shot job to run now
        scheduler.add_job(
            collect_daily_reward,
            trigger='date',
            run_date=datetime.now(),
            args=[account.id],
            id=f"manual_collect_{account_id}_{int(datetime.now().timestamp())}",
            name=f"Manual Collect for {account.name}"
        )
        emit_status_log(f"Queued manual 'Collect Now' job for '{account.name}'.", "System", "info")
        return True, "Job queued successfully"

def trigger_all_collections_now():
    """Queues manual collection jobs for all enabled accounts to run immediately."""
    from app import app
    with app.app_context():
        enabled_accounts = Account.query.filter_by(enabled=True).all()
        if not enabled_accounts:
            return False, "No active accounts configured"
            
        for account in enabled_accounts:
            scheduler.add_job(
                collect_daily_reward,
                trigger='date',
                run_date=datetime.now(),
                args=[account.id],
                id=f"manual_collect_{account.id}_{int(datetime.now().timestamp())}",
                name=f"Manual Collect for {account.name}"
            )
            emit_status_log(f"Queued manual 'Collect Now' job for '{account.name}'.", "System", "info")
        return True, f"Queued jobs for {len(enabled_accounts)} accounts"
