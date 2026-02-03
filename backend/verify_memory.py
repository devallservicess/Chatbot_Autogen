import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_memory():
    # Make sure backend is running (I'll assume it is as per terminal history)
    session_id = f"test_session_{int(time.time())}"
    
    print(f"--- Testing Session: {session_id} ---")
    
    # Message 1
    msg1 = {"message": "My name is Antigravity", "sessionId": session_id}
    print(f"Sending: {msg1['message']}")
    r1 = requests.post(f"{BASE_URL}/chat", json=msg1)
    print(f"Response 1: {r1.json().get('response')}\n")
    
    # Message 2
    msg2 = {"message": "What is my name?", "sessionId": session_id}
    print(f"Sending: {msg2['message']}")
    r2 = requests.post(f"{BASE_URL}/chat", json=msg2)
    response2 = r2.json().get('response')
    print(f"Response 2: {response2}")
    
    if "Antigravity" in response2:
        print("\n✅ MEMORY TEST PASSED!")
    else:
        print("\n❌ MEMORY TEST FAILED!")

if __name__ == "__main__":
    try:
        test_memory()
    except Exception as e:
        print(f"Error: {e}")
