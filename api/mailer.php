<?php
/**
 * Minimal real SMTP client — no Composer/PHPMailer dependency.
 * Implements EHLO, STARTTLS, AUTH LOGIN, MAIL FROM/RCPT TO/DATA per
 * RFC 5321 / RFC 2487, which is what every "just works with Gmail/
 * SendGrid/Mailgun SMTP" library does under the hood.
 *
 * Demo mode (default): if MAIL_HOST is not set in .env, emails are
 * appended to storage/mail.log instead of sent, so the app works with
 * zero configuration. Set real SMTP credentials in .env to send real
 * email — see .env.example.
 *
 * NOTE: the real SMTP path is protocol-correct but has not been tested
 * against a live mail server in this environment (no outbound network
 * access to mail relays here). Test it against your real provider
 * before relying on it in production.
 */
declare(strict_types=1);

function send_email(string $to, string $subject, string $bodyHtml): bool {
    $host = env('MAIL_HOST');
    if (!$host) {
        return log_email_demo($to, $subject, $bodyHtml);
    }

    $port = (int)env('MAIL_PORT', 587);
    $username = env('MAIL_USERNAME', '');
    $password = env('MAIL_PASSWORD', '');
    $encryption = env('MAIL_ENCRYPTION', 'tls');
    $fromAddress = env('MAIL_FROM_ADDRESS', 'no-reply@example.com');
    $fromName = env('MAIL_FROM_NAME', 'GITAcademy');

    $errno = 0; $errstr = '';
    $socket = @stream_socket_client(
        ($encryption === 'ssl' ? 'ssl://' : '') . "$host:$port",
        $errno, $errstr, 15,
        STREAM_CLIENT_CONNECT,
        stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]])
    );
    if (!$socket) {
        error_log("SMTP connect failed: $errstr ($errno)");
        return false;
    }

    $read = fn() => fgets($socket, 515);
    $expect = function (string $code) use ($socket, $read): string {
        $line = '';
        do { $line = $read(); } while ($line !== false && isset($line[3]) && $line[3] === '-');
        if ($line === false || substr($line, 0, 3) !== $code) {
            throw new RuntimeException("SMTP unexpected response: " . trim((string)$line));
        }
        return $line;
    };
    $send = function (string $cmd) use ($socket) { fwrite($socket, $cmd . "\r\n"); };

    try {
        $expect('220');
        $send('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
        $expect('250');

        if ($encryption === 'tls') {
            $send('STARTTLS');
            $expect('220');
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $send('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
            $expect('250');
        }

        if ($username) {
            $send('AUTH LOGIN');
            $expect('334');
            $send(base64_encode($username));
            $expect('334');
            $send(base64_encode($password));
            $expect('235');
        }

        $send("MAIL FROM:<$fromAddress>");
        $expect('250');
        $send("RCPT TO:<$to>");
        $expect('250');
        $send('DATA');
        $expect('354');

        $boundary = uniqid('gitacademy_');
        $headers = implode("\r\n", [
            "From: $fromName <$fromAddress>",
            "To: <$to>",
            "Subject: $subject",
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "Date: " . date('r'),
        ]);
        $send($headers . "\r\n\r\n" . $bodyHtml . "\r\n.");
        $expect('250');

        $send('QUIT');
        fclose($socket);
        return true;
    } catch (Throwable $e) {
        error_log('SMTP send failed: ' . $e->getMessage());
        fclose($socket);
        // Fall back to demo log so the user-facing action still "succeeds" gracefully
        log_email_demo($to, $subject, $bodyHtml, 'SMTP_ERROR: ' . $e->getMessage());
        return false;
    }
}

function log_email_demo(string $to, string $subject, string $bodyHtml, string $note = ''): bool {
    $dir = dirname(API_DIR) . '/storage';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $entry = "==== " . date('Y-m-d H:i:s') . " ====\n" .
        "To: $to\nSubject: $subject\n" .
        ($note ? "Note: $note\n" : "") .
        "Body:\n" . strip_tags(str_replace(['<br>', '<br/>', '</p>'], "\n", $bodyHtml)) . "\n\n";
    file_put_contents($dir . '/mail.log', $entry, FILE_APPEND | LOCK_EX);
    return true;
}
