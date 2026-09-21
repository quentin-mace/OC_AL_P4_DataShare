<?php

namespace App\Validator;

use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;

final class AuthenticatedOnlyValidator extends ConstraintValidator
{
    public function __construct(
        private readonly Security $security,
    ) {
    }

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof AuthenticatedOnly) {
            throw new UnexpectedTypeException($constraint, AuthenticatedOnly::class);
        }

        // An empty value is an absent field, not a submitted one: a browser
        // form posts its fields whether or not they were filled in, which is
        // also why MultipartDecoder drops empty strings. Nothing submitted,
        // nothing to restrict.
        if (null === $value || [] === $value || '' === $value) {
            return;
        }

        if (null !== $this->security->getUser()) {
            return;
        }

        $this->context->buildViolation($constraint->message)->addViolation();
    }
}
