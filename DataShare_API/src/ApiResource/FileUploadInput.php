<?php

namespace App\ApiResource;

use App\Validator\ForbiddenExtension;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

final class FileUploadInput
{
    #[Assert\NotNull(message: 'Un fichier est requis.')]
    #[Assert\File(maxSize: '1G')]
    #[ForbiddenExtension]
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
     * @var list<string>
     */
    #[Assert\All([new Assert\Length(max: 30)])]
    public array $tags = [];

    #[Assert\Callback]
    public function validateTags(ExecutionContextInterface $context): void
    {
        if (count($this->tags) !== count(array_unique($this->tags))) {
            $context->buildViolation('Un meme tag ne peut pas etre soumis deux fois.')
                ->atPath('tags')
                ->addViolation();
        }
    }
}
