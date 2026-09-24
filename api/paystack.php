<?php
/**
 * Real Paystack payment gateway client (https://paystack.com).
 * Paystack supports GHS directly, including Ghanaian Mobile Money
 * (MTN, Vodafone, AirtelTigo) and card payments — the standard choice
 * for a Ghana-based platform.
 *
 * Real mode: used automatically when PAYSTACK_SECRET_KEY is set in .env.
 * Demo mode: when not set, payments.checkout() in api/index.php completes
 * instantly without calling any of this — see paystack_is_configured().
 *
 * NOTE: this client calls the real https://api.paystack.co endpoints per
 * Paystack's public API docs, but has not been exercised against a live
 * Paystack account in this environment (no outbound network access to
 * paystack.co here, and no real key to test with). Test against your own
 * Paystack test-mode key before going live.
 */
declare(strict_types=1);

function paystack_is_configured(): bool {
    return (bool)env('PAYSTACK_SECRET_KEY');
}

function paystack_request(string $method, string $path, array $data = []): array {
    $secretKey = env('PAYSTACK_SECRET_KEY');
    $ch = curl_init("https://api.paystack.co$path");
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $secretKey",
            'Content-Type: application/json',
            'Cache-Control: no-cache',
        ],
        CURLOPT_TIMEOUT => 20,
    ];
    if ($method === 'POST' && $data) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($data);
    }
    curl_setopt_array($ch, $opts);
    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno) {
        throw new RuntimeException("Paystack request failed: $error");
    }
    $decoded = json_decode((string)$response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Paystack returned an unexpected response.');
    }
    if ($httpCode >= 400) {
        throw new RuntimeException($decoded['message'] ?? 'Paystack request failed.');
    }
    return $decoded;
}

/**
 * Starts a real Paystack transaction. Amount must be in GHS (major unit);
 * this converts to pesewas (minor unit) as Paystack requires.
 * Returns ['authorization_url' => ..., 'access_code' => ..., 'reference' => ...]
 */
function paystack_initialize(string $email, float $amountGhs, string $reference, string $callbackUrl, array $metadata = []): array {
    $result = paystack_request('POST', '/transaction/initialize', [
        'email' => $email,
        'amount' => (int)round($amountGhs * 100), // GHS -> pesewas
        'currency' => 'GHS',
        'reference' => $reference,
        'callback_url' => $callbackUrl,
        'metadata' => $metadata,
    ]);
    return $result['data'] ?? [];
}

/** Verifies a transaction by reference. Returns Paystack's transaction data, including ['status' => 'success'|...]. */
function paystack_verify(string $reference): array {
    $result = paystack_request('GET', '/transaction/verify/' . rawurlencode($reference));
    return $result['data'] ?? [];
}

/** Verifies the x-paystack-signature header on an incoming webhook — real HMAC check, not decorative. */
function paystack_verify_webhook_signature(string $rawBody, string $signatureHeader): bool {
    $secretKey = env('PAYSTACK_SECRET_KEY');
    if (!$secretKey || !$signatureHeader) return false;
    $expected = hash_hmac('sha512', $rawBody, $secretKey);
    return hash_equals($expected, $signatureHeader);
}
