<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiProperty;
use App\Validator\AuthenticatedOnly;
use App\Validator\ForbiddenExtension;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

final class FileUploadInput
{
    #[Assert\NotNull(message: 'A file is required.')]
    #[Assert\File(maxSize: '1G')]
    #[ForbiddenExtension]
    // Without this, the nullable PHP type makes API Platform document this
    // as {"type": ["string", "null"], "format": "binary"} (OpenAPI 3.1 union
    // syntax). Swagger UI only renders a file picker when "type" is exactly
    // the string "string", so a type array silently falls back to a plain
    // text input, and submitting it sends "file" as text instead of an
    // actual upload.
    #[ApiProperty(openapiContext: ['type' => 'string', 'format' => 'binary'])]
    public ?UploadedFile $file = null;

    /**
     * A multipart field, so it arrives as a string; kept as one since the
     * serializer does not coerce numeric strings to int-typed properties.
     * Range still validates it correctly (is_numeric() before comparing).
     */
    #[Assert\Range(min: 1, max: 7)]
    public ?string $expiresInDays = null;

    #[Assert\Length(min: 6)]
    public ?string $password = null;

    /**
     * Submitted either as a comma-separated list in a single "tags" field, or
     * as a repeated "tags[]" field; MultipartDecoder normalises both, trimming
     * each name and dropping the blanks, so what lands here is ready to
     * compare and to look up.
     *
     * @var list<string>
     */
    #[ApiProperty(
        description: 'Comma-separated list of tags. A tag can therefore not contain a comma.',
        openapiContext: ['type' => 'string', 'example' => 'invoice,client-x'],
    )]
    #[Assert\All([new Assert\Length(max: 30)])]
    // A tag belongs to an account: it is reused across that account's files
    // and filters its history, neither of which an anonymous upload has.
    #[AuthenticatedOnly(message: 'Tags are reserved for signed-in accounts.')]
    public array $tags = [];

    #[Assert\Callback]
    public function validateTags(ExecutionContextInterface $context): void
    {
        if (count($this->tags) !== count(array_unique($this->tags))) {
            $context->buildViolation('The same tag cannot be submitted twice.')
                ->atPath('tags')
                ->addViolation();
        }
    }
}
