import requests, time, json

url = 'http://127.0.0.1:8000/api/auth/login'
payload = {'email': 'admin@example.com', 'password': 'password'}
headers = {'Content-Type': 'application/json'}

# Warm-up request
requests.post(url, json=payload, headers=headers)

# Measure multiple requests
times = []
for i in range(5):
    start = time.time()
    resp = requests.post(url, json=payload, headers=headers)
    elapsed = time.time() - start
    times.append(elapsed)
    print(f'Request {i+1}: status {resp.status_code}, time {elapsed:.3f}s')

avg = sum(times) / len(times)
print(f'Average response time: {avg:.3f}s')
