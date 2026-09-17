<?php

namespace App\Validator;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;

final class ForbiddenExtensionValidator extends ConstraintValidator
{
    /**
     * @param list<string> $forbiddenExtensions extensions compared case-insensitively, without the leading dot
     */
    public function __construct(
        #[Autowire(param: 'app.forbidden_file_extensions')]
        private readonly array $forbiddenExtensions,
    ) {
    }

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof ForbiddenExtension) {
            throw new UnexpectedTypeException($constraint, ForbiddenExtension::class);
        }

        if (null === $value) {
            return;
        }

        if (!$value instanceof UploadedFile) {
            throw new UnexpectedValueException($value, UploadedFile::class);
        }

        $extension = strtolower(pathinfo($value->getClientOriginalName(), PATHINFO_EXTENSION));

        if (in_array($extension, $this->forbiddenExtensions, true)) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ extension }}', $extension)
                ->addViolation();
        }
    }
}
