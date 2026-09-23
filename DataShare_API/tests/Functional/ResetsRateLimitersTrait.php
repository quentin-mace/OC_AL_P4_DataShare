<?php

namespace App\Tests\Functional;

trait ResetsRateLimitersTrait
{
    /**
     * The rate limiters count in a cache pool, which outlives the database
     * transaction: without this, failures from one test would be held against
     * the next one. It matters most for the counters keyed on the client
     * address, since every test in the suite calls from the same one.
     */
    protected function resetRateLimiters(): void
    {
        static::getContainer()->get('cache.rate_limiter')->clear();
    }
}
