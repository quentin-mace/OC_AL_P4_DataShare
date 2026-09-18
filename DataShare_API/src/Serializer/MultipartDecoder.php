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

        // An HTML form field cannot be omitted the way a JSON key can, so a
        // client that leaves an optional field untouched (Swagger UI's
        // multipart "Try it out" included) still submits it, as an empty
        // string. Treat that the same as an absent field, so it falls back
        // to its default rather than fail to denormalize (e.g. an empty
        // string where the "tags" array is expected) or read as an invalid
        // value (e.g. an empty "password" rejected as too short).
        $fields = array_filter(
            $request->request->all(),
            static fn (mixed $value): bool => '' !== $value,
        );

        return array_merge($fields, $request->files->all());
    }

    public function supportsDecoding(string $format): bool
    {
        return self::FORMAT === $format;
    }
}
