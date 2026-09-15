<?php

namespace App\EventListener;

use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationFailureEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Events;
use Lexik\Bundle\JWTAuthenticationBundle\Response\JWTAuthenticationFailureResponse;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;

/**
 * Lexik answers every authentication failure with a 401, which tells a throttled
 * caller that their credentials are wrong rather than that they should wait.
 */
#[AsEventListener(event: Events::AUTHENTICATION_FAILURE)]
final class ThrottledLoginResponseListener
{
    public function __invoke(AuthenticationFailureEvent $event): void
    {
        $response = $event->getResponse();

        if (!$event->getException() instanceof TooManyLoginAttemptsAuthenticationException
            || !$response instanceof JWTAuthenticationFailureResponse) {
            return;
        }

        // Rebuilt rather than patched: the status code is copied into the body
        // when the response is created.
        $event->setResponse(new JWTAuthenticationFailureResponse(
            $response->getMessage(),
            Response::HTTP_TOO_MANY_REQUESTS,
        ));
    }
}
