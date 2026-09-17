<?php

namespace App\Serializer;

use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Serializer\Encoder\DecoderInterface;

/**
 * The Symfony serializer has no built-in support for multipart/form-data:
 * this feeds it the current request's fields and uploaded files as a plain
 * array, exactly what ObjectNormalizer expects to denormalize FileUploadInput.
 */
final readonly class MultipartDecoder implements DecoderInterface
{
    public const string FORMAT = 'multipart';

    public function __construct(
        private RequestStack $requestStack,
    ) {
    }

    /**
     * @param array<string, mixed> $context
     *
     * @return array<string, mixed>
     */
    public function decode(string $data, string $format, array $context = []): array
    {
        $request = $this->requestStack->getCurrentRequest();

        if (null === $request) {
            return [];
        }

        return array_merge($request->request->all(), $request->files->all());
    }

    public function supportsDecoding(string $format): bool
    {
        return self::FORMAT === $format;
    }
}
