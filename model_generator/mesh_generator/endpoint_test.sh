#!/bin/bash
# ==============================================================================
# ComfyUI API Test Script (Clean & Robust)
# ==============================================================================

API_URL="http://localhost:8000"
TOKEN="my-secret-token-123"
IMAGE_FILE="example.png"
OUTPUT_MODEL="my_generated_model.glb"
POLL_INTERVAL=5       # seconds
TIMEOUT=1200          # 20 minutes

# Check required commands
for cmd in curl base64 jq; do
    if ! command -v $cmd &> /dev/null; then
        echo "Error: Required command '$cmd' is not installed."
        exit 1
    fi
done

if [ ! -f "$IMAGE_FILE" ]; then
    echo "Error: Image file not found at '$IMAGE_FILE'"
    exit 1
fi

echo "Starting ComfyUI API Test..."
echo "API URL: $API_URL"
echo "Image File: $IMAGE_FILE"
echo "Output Model: $OUTPUT_MODEL"
echo "---"

# Generate unique request ID
REQUEST_ID="test-$(date +%s)"
IMAGE_B64=$(base64 -w 0 "$IMAGE_FILE")

# Create JSON payload
JSON_PAYLOAD_FILE=$(mktemp)
trap 'rm -f "$JSON_PAYLOAD_FILE"' EXIT

cat <<EOF > "$JSON_PAYLOAD_FILE"
{
  "id": "${REQUEST_ID}",
  "image": "${IMAGE_B64}"
}
EOF

# Step 1: Start generation
echo "Step 1: Starting generation..."
GENERATE_RESPONSE=$(curl -s -X POST "${API_URL}/generate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d @"${JSON_PAYLOAD_FILE}")

STATUS=$(echo "$GENERATE_RESPONSE" | jq -r '.status')

# Accept both "queued" and "processing" as valid initial states
if [ "$STATUS" != "processing" ] && [ "$STATUS" != "queued" ]; then
    echo "❌ Error: Failed to start generation."
    echo "Expected status 'queued' or 'processing', got: '$STATUS'"
    echo "$GENERATE_RESPONSE" | jq .
    exit 1
fi

echo "Generation started successfully! (Status: $STATUS)"
echo "Request ID: $REQUEST_ID"
echo ""
echo "Step 2: Waiting for completion..."

# Step 2: Poll for status
START_TIME=$(date +%s)
MODEL_URL=""

while true; do
    STATUS_RESPONSE=$(curl -s -X GET "${API_URL}/status/${REQUEST_ID}" \
        -H "Authorization: Bearer ${TOKEN}")

    CURRENT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    COMPLETION_MESSAGE=$(echo "$STATUS_RESPONSE" | jq -r '.message // empty')
    MODEL_URL=$(echo "$STATUS_RESPONSE" | jq -r '.model_url // empty')

    # Check for error status
    if [ "$CURRENT_STATUS" == "error" ]; then
        echo -e "\n❌ Error: Generation failed."
        echo "Message: $COMPLETION_MESSAGE"
        exit 1
    fi

    # Check for completion
    if [ "$CURRENT_STATUS" == "completed" ]; then
        if [ -n "$MODEL_URL" ] && [ "$MODEL_URL" != "null" ]; then
            echo -e "\nGeneration complete!"
            echo "Status: $CURRENT_STATUS"
            echo "Message: $COMPLETION_MESSAGE"
            break
        else
            echo -e "\nWarning: Status is 'completed' but no model URL found."
            echo "$STATUS_RESPONSE" | jq .
        fi
    fi

    # Show progress with status
    echo -n "."

    sleep $POLL_INTERVAL

    # Check timeout
    ELAPSED=$(( $(date +%s) - START_TIME ))
    if [ $ELAPSED -gt $TIMEOUT ]; then
        echo -e "\n❌ Error: Generation timed out after ${TIMEOUT} seconds."
        echo "Last status: $CURRENT_STATUS"
        echo "Last message: $COMPLETION_MESSAGE"
        exit 1
    fi
done

# Step 3: Download the model
echo ""
echo "Step 3: Downloading model..."

if [ -z "$MODEL_URL" ] || [ "$MODEL_URL" == "null" ]; then
    echo "❌ Error: Could not determine model URL."
    echo "Response was: $STATUS_RESPONSE"
    exit 1
fi

FULL_MODEL_URL="${API_URL}${MODEL_URL}"
echo "Downloading from: $FULL_MODEL_URL"

HTTP_CODE=$(curl -s -L -o "$OUTPUT_MODEL" -w "%{http_code}" "$FULL_MODEL_URL" \
    -H "Authorization: Bearer ${TOKEN}")

if [ "$HTTP_CODE" == "200" ] && [ -f "$OUTPUT_MODEL" ]; then
    FILE_SIZE=$(stat -f%z "$OUTPUT_MODEL" 2>/dev/null || stat -c%s "$OUTPUT_MODEL" 2>/dev/null)
    echo "Success! Model downloaded to '${OUTPUT_MODEL}'"
    echo "File size: ${FILE_SIZE} bytes"
else
    echo "❌ Error: Failed to download the model file."
    echo "HTTP code: $HTTP_CODE"
    if [ -f "$OUTPUT_MODEL" ]; then
        rm "$OUTPUT_MODEL"
    fi
    exit 1
fi

echo ""
echo "All done!"
