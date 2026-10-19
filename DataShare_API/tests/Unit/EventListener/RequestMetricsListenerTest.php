<?php

namespace App\Tests\Unit\EventListener;

use App\EventListener\RequestMetricsListener;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\TerminateEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;

#[CoversClass(RequestMetricsListener::class)]
final class RequestMetricsListenerTest extends TestCase
{
    /**
     * The context of the single line the listener is expected to write.
     *
     * @var array<string, mixed>|null
     */
    private ?array $logged = null;

    public function testItLogsOneLinePerApplicationRequest(): void
    {
        $request = Request::create('/api/files', 'POST');
        $request->attributes->set('_route', '_api_/files_post');
        $request->headers->set('Content-Length', '2048');
        $request->server->set('REQUEST_TIME_FLOAT', microtime(true));

        $this->handle($request, 201);

        self::assertNotNull($this->logged);
        self::assertSame('_api_/files_post', $this->logged['route']);
        self::assertSame('POST', $this->logged['method']);
        self::assertSame('/api/files', $this->logged['path']);
        self::assertSame(201, $this->logged['status']);
        self::assertSame(2048, $this->logged['request_bytes']);
        self::assertIsFloat($this->logged['duration_ms']);
        self::assertGreaterThanOrEqual(0.0, $this->logged['duration_ms']);
    }

    /**
     * The profiler and the web debug toolbar fire on every page in
     * development, and would outnumber the API's own requests in the
     * aggregates. The API Platform operations must survive the same filter,
     * their route names starting with an underscore as well.
     */
    public function testItIgnoresTheProfilerButKeepsTheApiRoutes(): void
    {
        $profiler = Request::create('/_wdt/abc123');
        $profiler->attributes->set('_route', '_wdt');

        $this->handle($profiler, 200);

        self::assertNull($this->logged);
    }

    /**
     * A 404 never reaches a route, and a request body is not always declared:
     * the line must still be written, with holes rather than an exception.
     */
    public function testItLogsARequestWithoutRouteOrContentLength(): void
    {
        $this->handle(Request::create('/api/unknown'), 404);

        self::assertNotNull($this->logged);
        self::assertNull($this->logged['route']);
        self::assertNull($this->logged['request_bytes']);
        self::assertSame(404, $this->logged['status']);
    }

    private function handle(Request $request, int $status): void
    {
        // A stub and not a mock: the assertions bear on what was logged, which
        // $this->logged carries, and PHPUnit rejects a mock without
        // expectations.
        $logger = $this->createStub(LoggerInterface::class);
        $logger->method('info')
            ->willReturnCallback(function (string|\Stringable $message, array $context): void {
                self::assertSame('request', $message);
                $this->logged = $context;
            });

        $event = new TerminateEvent(
            $this->createStub(HttpKernelInterface::class),
            $request,
            new Response('', $status),
        );

        (new RequestMetricsListener($logger))($event);
    }
}
