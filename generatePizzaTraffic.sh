#!/bin/bash

# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

# Trap SIGINT (Ctrl+C) to execute the cleanup function
cleanup() {
  echo "Terminating background processes..."
  kill $pid1 $pid2 $pid3 $pid4 $pid5 $pid6
  exit 0
}
trap cleanup SIGINT

# Wrap curl command to return HTTP response codes
execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

# Function to login and get a token (without jq)
login() {
  response=$(curl -s -X PUT $host/api/auth -d "{\"email\":\"$1\", \"password\":\"$2\"}" -H 'Content-Type: application/json')
  # Extract token from JSON response without jq
  # Look for "token":"value" pattern and extract the value
  # Try multiple extraction methods for robustness
  token=$(echo $response | grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
  
  # Fallback: if first method fails, try simpler pattern
  if [ -z "$token" ] || [ "$token" = "null" ]; then
    token=$(echo $response | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  fi
  
  echo $token
}

# Simulate a user requesting the menu every 3 seconds
while true; do
  result=$(execute_curl $host/api/order/menu)
  echo "Requesting menu..." $result
  sleep 3
done &
pid1=$!

# Simulate a user with an invalid email and password every 25 seconds
while true; do
  result=$(execute_curl "-X PUT \"$host/api/auth\" -d '{\"email\":\"unknown@jwt.com\", \"password\":\"bad\"}' -H 'Content-Type: application/json'")
  echo "Logging in with invalid credentials..." $result
  sleep 25
done &
pid2=$!

# Simulate a franchisee logging in every two minutes
while true; do
  token=$(login "f@jwt.com" "franchisee")
  echo "Login franchisee..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 110
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out franchisee..." $result
  sleep 10
done &
pid3=$!

# Simulate a diner ordering a pizza every 50 seconds
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login diner..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought a pizza..." $result
  sleep 20
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out diner..." $result
  sleep 30
done &
pid4=$!

# Simulate a failed pizza order every 5 minutes
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login hungry diner..." $( [ -z "$token" ] && echo "false" || echo "true" )

  items='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
  for (( i=0; i < 21; i++ ))
  do items+=', { "menuId": 1, "description": "Veggie", "price": 0.05 }'
  done
  
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought too many pizzas..." $result  
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out hungry diner..." $result
  sleep 295
done &
pid5=$!

# Simulate user login spikes - burst of logins every 30 seconds
while true; do
  echo "=== Creating user login spike ==="
  tokens=()
  
  # Burst login: 10 users logging in quickly
  for (( i=1; i <= 10; i++ ))
  do
    token=$(login "d@jwt.com" "diner")
    if [ ! -z "$token" ] && [ "$token" != "null" ]; then
      tokens+=("$token")
      echo "Spike user $i logged in"
    fi
    sleep 0.3  # Small delay between logins
  done
  
  echo "Spike: ${#tokens[@]} users logged in, keeping them active for 15 seconds..."
  sleep 15  # Keep users active for 15 seconds
  
  # Logout all users in the spike
  echo "=== Logging out spike users ==="
  for token in "${tokens[@]}"
  do
    result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
    echo "Spike user logged out..." $result
    sleep 0.2  # Small delay between logouts
  done
  
  echo "Spike complete, waiting 15 seconds before next spike..."
  sleep 15  # Wait before next spike
done &
pid6=$!


# Wait for the background processes to complete
wait $pid1 $pid2 $pid3 $pid4 $pid5 $pid6