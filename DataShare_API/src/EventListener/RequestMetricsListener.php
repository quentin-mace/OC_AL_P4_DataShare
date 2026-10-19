<?php

namespace App\EventListener;

use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\TerminateEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * One JSON line per request on the "metrics" channel, so that response times
 * can be measured without an external probe. Nothing else in the application
 * logs anything: nginx only knows URLs and byte counts, not routes.
 *
 * The duration starts at REQUEST_TIME_FLOAT, which PHP-FPM sets once the
 * request body has been received. On a 1 GB upload it therefore reports the
 * server-side processing alone, the transfer time staying visible in the
 * client-side figures k6 reports. Reading the two together is the point.
 */
#[AsEventListener(event: KernelEvents::TERMINATE)]
final readonly class RequestMetricsListener
{
    public function __construct(
        #[Autowire(service: 'monolog.logger.metrics')]
        private LoggerInterface $logger,
    ) {
    }

    public function __invoke(TerminateEvent $event): void
    {
        $request = $event->getRequest();
        $path = $request->getPathInfo();

        // The profiler and the web debug toolbar fire on every page in
        // development and would outnumber the API's own requests. Filtering
        // on the path and not on the route name, which starts with an
        // underscore for the API Platform operations too (_api_/files_post).
        if (str_starts_with($path, '/_')) {
            return;
        }

        $route = $request->attributes->get('_route');
        $startedAt = $request->server->get('REQUEST_TIME_FLOAT');
        $contentLength = $request->headers->get('Content-Length');

        $this->logger->info('request', [
            'route' => is_string($route) ? $route : null,
            'method' => $request->getMethod(),
            'path' => $path,
            'status' => $event->getResponse()->getStatusCode(),
            'duration_ms' => is_numeric($startedAt)
                ? round((microtime(true) - (float) $startedAt) * 1000, 1)
                : null,
            'request_bytes' => is_numeric($contentLength) ? (int) $contentLength : null,
        ]);
    }
}
