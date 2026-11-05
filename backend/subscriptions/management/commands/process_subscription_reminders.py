from django.core.management.base import BaseCommand
from subscriptions.services import check_and_send_subscription_reminders


class Command(BaseCommand):
    help = "Daily cron task to expire lapsed salon subscriptions and send 7/3/1-day reminder alerts."

    def handle(self, *args, **options):
        self.stdout.write("Checking subscription statuses and dispatching reminders...")
        check_and_send_subscription_reminders()
        self.stdout.write(self.style.SUCCESS("Subscription audit and reminder check completed successfully."))

