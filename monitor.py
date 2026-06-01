import requests
from bs4 import BeautifulSoup
import time
import os
from twilio.rest import Client

CLIENTS = [
    {
        "name": "Test Site",
        "url": "https://www.google.com",
        "check_element": "input",
        "phone": "+1234567890"
    }
]

def send_alert(message, to_phone):
    sid = os.environ.get('TWILIO_SID')
    token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_n = os.environ.get('TWILIO_PHONE')
    if not sid or not token: return
    try:
        client = Client(sid, token)
        client.messages.create(body=f"🚨 ASG ALERT: {message}", from_=from_n, to=to_phone)
    except Exception as e: print(f"Error: {e}")

def run_asg():
    for client in CLIENTS:
        try:
            start = time.time()
            res = requests.get(client['url'], timeout=15)
            load_time = time.time() - start
            if res.status_code != 200:
                send_alert(f"Site DOWN: {res.status_code}", client['phone'])
            elif load_time > 7:
                send_alert(f"Site SLOW: {round(load_time, 2)}s", client['phone'])
            else:
                print(f"{client['name']} is OK ✅")
        except Exception as e:
            send_alert(f"Connection Error", client['phone'])

if __name__ == "__main__":
    run_asg()
