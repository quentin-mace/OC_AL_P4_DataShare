<?php

namespace App\State;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\Attribute\Target;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/**
 * Counts the failed password attempts on a download link, so that a six
 * character password cannot simply be guessed at speed.
 *
 * Two counters, mirroring what login_throttling does for accounts: one on the
 * link itself, and a wider one on the client. The link is what carries the
 * security here, since the secret being attacked belongs to the link and not to
 * whoever is trying it; keying on the link plus the IP address, as the login
 * does, would let an attacker start over by rotating addresses.
 */
final readonly class DownloadPasswordThrottle
{
    /**
     * One message for both counters: naming the one that tripped would tell an
     * attacker whether they are being held back on this link or on their own
     * address, which is exactly what they need to know to adapt. It also stays
     * true in both cases.
     */
    private const string MESSAGE = 'Too many password attempts. Try again later.';

    public function __construct(
        #[Target('download_password_link')]
        private RateLimiterFactoryInterface $linkLimiter,
        #[Target('download_password_client')]
        private RateLimiterFactoryInterface $clientLimiter,
        private RequestStack $requestStack,
        #[Autowire('%kernel.secret%')]
        private string $secret,
    ) {
    }

    /**
     * Has to be called before the password is compared: checking afterwards
     * would leave an attacker free to keep going until they land on the right
     * one.
     *
     * @throws TooManyRequestsHttpException
     */
    public function ensureAnAttemptIsAllowed(string $downloadToken): void
    {
        foreach ([$this->linkLimiterFor($downloadToken), $this->clientLimiter()] as $limiter) {
            $rateLimit = $limiter->consume(0);

            // consume(0) reports every peek as accepted, in fixed_window as in
            // sliding_window, so the remaining tokens have to be read too;
            // Symfony works around it the same way in LoginThrottlingListener.
            // Without the second test the limit lets one attempt too many
            // through, silently.
            if (!$rateLimit->isAccepted() || 0 === $rateLimit->getRemainingTokens()) {
                $retryAfter = max(0, $rateLimit->getRetryAfter()->getTimestamp() - time());

                throw new TooManyRequestsHttpException($retryAfter, self::MESSAGE);
            }
        }
    }

    /**
     * Only failures are counted: a recipient who types the right password must
     * never eat into their own budget, otherwise reloading the page a few times
     * would be enough to lock themselves out.
     */
    public function recordFailedAttempt(string $downloadToken): void
    {
        $this->linkLimiterFor($downloadToken)->consume();
        $this->clientLimiter()->consume();
    }

    /**
     * The client counter is deliberately left untouched. The login resets both,
     * but that would be a hole here: an attacker sweeping many links while
     * legitimately holding one of them could refill their IP budget at will. A
     * right password on one link says nothing about the others.
     */
    public function forgetFailedAttempts(string $downloadToken): void
    {
        $this->linkLimiterFor($downloadToken)->reset();
    }

    private function linkLimiterFor(string $downloadToken): LimiterInterface
    {
        return $this->linkLimiter->create($this->hash($downloadToken));
    }

    private function clientLimiter(): LimiterInterface
    {
        $clientIp = $this->requestStack->getMainRequest()?->getClientIp() ?? 'unknown';

        return $this->clientLimiter->create($this->hash($clientIp));
    }

    /**
     * The cache storage hashes the identifier to build its key, but serialises
     * it in clear inside the stored value. A download token grants access to a
     * file and an IP address is personal data, so neither is written down as
     * is. Same reasoning, and same form, as DefaultLoginRateLimiter::hash().
     */
    private function hash(string $value): string
    {
        return strtr(substr(base64_encode(hash_hmac('sha256', $value, $this->secret, true)), 0, 16), '/+', '._');
    }
}
