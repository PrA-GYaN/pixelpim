# API Keys and Webhooks Documentation

## Overview

PixelPim provides API key and secret key management for secure access to your data, along with an event-based webhook system to receive real-time notifications about changes in your product catalog.

## API Keys

### What are API Keys?

API keys are unique identifiers that allow secure access to your PixelPim account via the REST API. Each user has one API key and secret key pair.

- **API Key**: Public identifier (starts with `pk_`)
- **Secret Key**: Private key for signing requests (starts with `sk_`)

### Managing API Keys

#### Generate API Keys

**Endpoint:** `POST /api-keys/generate`

**Authentication:** JWT token required

**Response:**
```json
{
  "apiKey": "pk_abc123...",
  "secretKey": "sk_xyz789..."
}
```

⚠️ **Important:** Store your secret key securely. It cannot be retrieved again after generation.

#### View API Keys

**Endpoint:** `GET /api-keys`

**Authentication:** JWT token required

**Response:**
```json
{
  "apiKey": "pk_abc123...",
  "secretKey": null  // Secret key is not returned for security
}
```

#### Regenerate API Keys

**Endpoint:** `POST /api-keys/regenerate`

**Authentication:** JWT token required

**Response:**
```json
{
  "apiKey": "pk_new456...",
  "secretKey": "sk_new789..."
}
```

⚠️ **Warning:** Regenerating keys will invalidate your existing keys. Update any integrations immediately.

### Using API Keys for Authentication

Include your API key in the `X-API-Key` header for API requests:

```
X-API-Key: pk_abc123...
```

## Webhooks

### What are Webhooks?

Webhooks allow you to receive real-time HTTP POST notifications when events occur in your PixelPim account. Each webhook request includes a JSON payload and HMAC signature for verification.

### Supported Events

- `product.created` - Triggered when a new product is created
- `product.updated` - Triggered when a product is updated
- `product.deleted` - Triggered when a product is deleted

### Managing Webhooks

#### Create a Webhook

**Endpoint:** `POST /webhooks`

**Authentication:** JWT token required

**Request Body:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["product.created", "product.updated"]
}
```

**Response:**
```json
{
  "id": 1,
  "userId": 123,
  "url": "https://your-app.com/webhook",
  "events": ["product.created", "product.updated"],
  "isActive": true,
  "createdAt": "2025-11-10T10:00:00.000Z",
  "updatedAt": "2025-11-10T10:00:00.000Z"
}
```

#### List Webhooks

**Endpoint:** `GET /webhooks`

**Authentication:** JWT token required

**Response:**
```json
[
  {
    "id": 1,
    "userId": 123,
    "url": "https://your-app.com/webhook",
    "events": ["product.created", "product.updated"],
    "isActive": true,
    "createdAt": "2025-11-10T10:00:00.000Z",
    "updatedAt": "2025-11-10T10:00:00.000Z"
  }
]
```

#### Update a Webhook

**Endpoint:** `PUT /webhooks/:id`

**Authentication:** JWT token required

**Request Body:**
```json
{
  "url": "https://your-app.com/new-webhook",
  "events": ["product.created", "product.updated", "product.deleted"],
  "isActive": false
}
```

#### Delete a Webhook

**Endpoint:** `DELETE /webhooks/:id`

**Authentication:** JWT token required

### Webhook Request Format

When an event occurs, PixelPim sends a POST request to your webhook URL with the following:

#### Headers

```
Content-Type: application/json
X-Webhook-Signature: sha256=abc123...
X-Webhook-Event: product.created
```

#### Body

```json
{
  "event": "product.created",
  "timestamp": "2025-11-10T10:00:00.000Z",
  "product": {
    "id": 123,
    "name": "iPhone 15 Pro",
    "sku": "IPH15P",
    "status": "complete",
    "categoryId": 456,
    "familyId": 789,
    "createdAt": "2025-11-10T10:00:00.000Z",
    "updatedAt": "2025-11-10T10:00:00.000Z",
    // ... full product object
  }
}
```

### Verifying Webhook Signatures

Each webhook request includes an HMAC signature in the `X-Webhook-Signature` header. Verify the signature using your secret key to ensure the request is authentic.

#### Example Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secretKey) {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(payload))
    .digest('hex');

  const receivedSignature = signature.replace('sha256=', '');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  );
}

// Usage in your webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  if (verifyWebhookSignature(payload, signature, process.env.PIXELPIM_SECRET_KEY)) {
    // Process the webhook
    console.log('Valid webhook received:', payload.event);
    res.status(200).send('OK');
  } else {
    res.status(401).send('Invalid signature');
  }
});
```

#### Example Verification (Python)

```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload, signature, secret_key):
    expected_signature = hmac.new(
        secret_key.encode(),
        json.dumps(payload, separators=(',', ':')).encode(),
        hashlib.sha256
    ).hexdigest()

    received_signature = signature.replace('sha256=', '')

    return hmac.compare_digest(expected_signature, received_signature)

# Usage in your webhook handler
@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_json()

    if verify_webhook_signature(payload, signature, os.environ['PIXELPIM_SECRET_KEY']):
        # Process the webhook
        print(f"Valid webhook received: {payload['event']}")
        return 'OK', 200
    else:
        return 'Invalid signature', 401
```

### Webhook Delivery

- Webhooks are delivered asynchronously
- Failed deliveries are retried up to 3 times with exponential backoff
- Delivery attempts are logged for debugging
- Webhooks must respond with a 2xx status code within 10 seconds

### Best Practices

1. **Security**: Always verify webhook signatures
2. **Idempotency**: Handle duplicate events gracefully
3. **Timeouts**: Respond quickly to webhook requests
4. **Logging**: Log webhook deliveries for debugging
5. **Error Handling**: Implement proper error handling for failed deliveries

### Troubleshooting

#### Webhook Not Receiving Events

- Check that the webhook URL is accessible from the internet
- Verify the webhook is active (`isActive: true`)
- Ensure the event type is included in the webhook's `events` array
- Check webhook delivery logs for errors

#### Invalid Signatures

- Ensure you're using the correct secret key
- Verify JSON serialization matches exactly (no extra whitespace)
- Check that you're using SHA256 HMAC

#### Delivery Failures

- Webhook endpoint must respond within 10 seconds
- Must return a 2xx status code
- Check server logs for detailed error information