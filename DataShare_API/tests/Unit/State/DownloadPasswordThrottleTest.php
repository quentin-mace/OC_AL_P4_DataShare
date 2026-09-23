<?php

namespace App\Tests\Unit\State;

use App\State\DownloadPasswordThrottle;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;
use Symfony\Component\RateLimiter\Storage\StorageInterface;

/**
 * Built on real limiter factories rather than doubles: RateLimiterFactory is
 * final, and InMemoryStorage makes the real counting logic, peek included,
 * cheap enough to exercise directly.
 */
#[CoversClass(DownloadPasswordThrottle::class)]
final class DownloadPasswordThrottleTest extends TestCase
{
    private const int LINK_LIMIT = 5;
    private const int CLIENT_LIMIT = 25;
    private const string TOKEN = 'a-download-token';
    private const string OTHER_TOKEN = 'another-download-token';

    public function testItAllowsTheFirstAttemptOnAFreshLink(): void
    {
        $throttle = $this->throttle();

        $throttle->ensureAnAttemptIsAllowed(self::TOKEN);

        $this->expectNotToPerformAssertions();
    }

    public function testItBlocksTheAttemptFollowingTheFifthFailure(): void
    {
        $throttle = $this->throttle();

        for ($attempt = 1; $attempt <= self::LINK_LIMIT; ++$attempt) {
            $throttle->ensureAnAttemptIsAllowed(self::TOKEN);
            $throttle->recordFailedAttempt(self::TOKEN);
        }

        $this->expectException(TooManyRequestsHttpException::class);

        $throttle->ensureAnAttemptIsAllowed(self::TOKEN);
    }

    /**
     * The one that matters: consume(0) reports a peek as accepted even when no
     * token is left, so a naive check would let a sixth attempt through without
     * anything failing visibly.
     */
    public function testTheLastAllowedAttemptIsNotSwallowedByThePeek(): void
    {
        $storage = new InMemoryStorage();
        $throttle = $this->throttle($storage);

        for ($attempt = 1; $attempt <= self::LINK_LIMIT; ++$attempt) {
            $throttle->recordFailedAttempt(self::TOKEN);
        }

        $peek = $this->linkLimiterFactory($storage)->create($this->expectedKeyFor(self::TOKEN))->consume(0);
        self::assertTrue($peek->isAccepted(), 'The premise of this test no longer holds.');
        self::assertSame(0, $peek->getRemainingTokens());

        $this->expectException(TooManyRequestsHttpException::class);

        $throttle->ensureAnAttemptIsAllowed(self::TOKEN);
    }

    public function testAnotherLinkIsUnaffected(): void
    {
        $throttle = $this->throttle();

        for ($attempt = 1; $attempt <= self::LINK_LIMIT; ++$attempt) {
            $throttle->recordFailedAttempt(self::TOKEN);
        }

        $throttle->ensureAnAttemptIsAllowed(self::OTHER_TOKEN);

        $this->expectNotToPerformAssertions();
    }

    /**
     * The counter is keyed on the link alone, so rotating addresses does not
     * reset it. This is the decision that separates us from login_throttling.
     */
    public function testTheSameLinkIsBlockedFromAnotherIp(): void
    {
        $storage = new InMemoryStorage();

        $attacker = $this->throttle($storage, '203.0.113.7');
        for ($attempt = 1; $attempt <= self::LINK_LIMIT; ++$attempt) {
            $attacker->recordFailedAttempt(self::TOKEN);
        }

        $this->expectException(TooManyRequestsHttpException::class);

        $this->throttle($storage, '198.51.100.4')->ensureAnAttemptIsAllowed(self::TOKEN);
    }

    public function testItBlocksAClientSpreadingFailuresOverManyLinks(): void
    {
        $throttle = $this->throttle();

        for ($attempt = 1; $attempt <= self::CLIENT_LIMIT; ++$attempt) {
            $throttle->recordFailedAttempt("token-{$attempt}");
        }

        $this->expectException(TooManyRequestsHttpException::class);

        $throttle->ensureAnAttemptIsAllowed('a-brand-new-token');
    }

    public function testASuccessClearsTheLinkCounterOnly(): void
    {
        $throttle = $this->throttle();

        for ($attempt = 1; $attempt <= self::LINK_LIMIT; ++$attempt) {
            $throttle->recordFailedAttempt(self::TOKEN);
        }

        $throttle->forgetFailedAttempts(self::TOKEN);

        // The link is usable again...
        $throttle->ensureAnAttemptIsAllowed(self::TOKEN);

        // ...but the client keeps the five failures it accumulated, so twenty
        // more are enough to block it.
        for ($attempt = 1; $attempt <= self::CLIENT_LIMIT - self::LINK_LIMIT; ++$attempt) {
            $throttle->recordFailedAttempt("token-{$attempt}");
        }

        $this->expectException(TooManyRequestsHttpException::class);

        $throttle->ensureAnAttemptIsAllowed(self::TOKEN);
    }

    public function testTheExceptionCarriesARetryAfterHeader(): void
    {
        $throttle = $this->throttle();

        for ($attempt = 1; $attempt <= self::LINK_LIMIT; ++$attempt) {
            $throttle->recordFailedAttempt(self::TOKEN);
        }

        try {
            $throttle->ensureAnAttemptIsAllowed(self::TOKEN);
            self::fail('Expected a TooManyRequestsHttpException to be thrown.');
        } catch (TooManyRequestsHttpException $exception) {
            self::assertArrayHasKey('Retry-After', $exception->getHeaders());
            self::assertGreaterThan(0, (int) $exception->getHeaders()['Retry-After']);
        }
    }

    /**
     * The token grants access to the file, so it must not be readable in the
     * storage, whether that storage is a local cache or a shared Redis.
     */
    public function testItDoesNotStoreTheTokenInClear(): void
    {
        $storage = new InMemoryStorage();

        $this->throttle($storage)->recordFailedAttempt(self::TOKEN);

        self::assertStringNotContainsString(self::TOKEN, serialize($storage));
    }

    private function throttle(?StorageInterface $storage = null, string $clientIp = '203.0.113.7'): DownloadPasswordThrottle
    {
        $storage ??= new InMemoryStorage();

        $requestStack = new RequestStack();
        $requestStack->push(Request::create('/api/downloads/'.self::TOKEN, 'POST', server: ['REMOTE_ADDR' => $clientIp]));

        return new DownloadPasswordThrottle(
            $this->linkLimiterFactory($storage),
            new RateLimiterFactory(
                ['id' => 'download_password_client', 'policy' => 'fixed_window', 'limit' => self::CLIENT_LIMIT, 'interval' => '15 minutes'],
                $storage,
            ),
            $requestStack,
            'a-test-secret',
        );
    }

    private function linkLimiterFactory(StorageInterface $storage): RateLimiterFactory
    {
        return new RateLimiterFactory(
            ['id' => 'download_password_link', 'policy' => 'fixed_window', 'limit' => self::LINK_LIMIT, 'interval' => '15 minutes'],
            $storage,
        );
    }

    /**
     * Mirrors the hashing the throttle applies before handing a value to the
     * limiter, so that a test can reach the very same counter.
     */
    private function expectedKeyFor(string $value): string
    {
        return strtr(substr(base64_encode(hash_hmac('sha256', $value, 'a-test-secret', true)), 0, 16), '/+', '._');
    }
}
