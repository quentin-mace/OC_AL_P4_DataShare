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

        if (isset($fields['tags'])) {
            $fields['tags'] = self::normalizeTags($fields['tags']);
        }

        return array_merge($fields, $request->files->all());
    }

    /**
     * Accepts both ways a form can carry a list of tags.
     *
     * PHP only builds an array when the field is literally named "tags[]";
     * a field repeated as plain "tags" is overwritten, and Swagger UI does
     * not even repeat it, it submits one comma-joined value. Splitting on the
     * comma is therefore what makes the documented field usable at all, at
     * the price of a tag name that cannot contain a comma. See
     * docs/architectureDecisions/tags.md.
     *
     * Trimming happens here rather than further down so that both forms reach
     * the duplicate check and the tag lookup identically: " facture" and
     * "facture" have to be the same tag, as they already are on
     * POST /api/files/{id}/tags.
     *
     * A blank segment is dropped rather than refused, which is the rule this
     * decoder already applies to an empty field just above: "facture," and
     * "a,,b" are separator artefacts, not submitted tags.
     */
    private static function normalizeTags(mixed $tags): mixed
    {
        if (is_string($tags)) {
            $tags = explode(',', $tags);
        }

        if (!is_array($tags)) {
            // Anything else is left untouched for the serializer to reject.
            return $tags;
        }

        $trimmed = array_map(
            static fn (mixed $tag): mixed => is_string($tag) ? trim($tag) : $tag,
            $tags,
        );

        return array_values(array_filter($trimmed, static fn (mixed $tag): bool => '' !== $tag));
    }

    public function supportsDecoding(string $format): bool
    {
        return self::FORMAT === $format;
    }
}
