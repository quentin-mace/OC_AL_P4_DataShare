<?php

namespace App\Validator;

use Symfony\Component\Validator\Constraint;

/**
 * Marks a field an anonymous client may not submit at all. Distinct from a
 * security expression on the operation, which is all or nothing: here the
 * route stays open and only one of its fields is restricted.
 */
#[\Attribute(\Attribute::TARGET_PROPERTY)]
class AuthenticatedOnly extends Constraint
{
    public string $message = 'Ce champ est reserve aux comptes connectes.';

    /**
     * Symfony 8 dropped the option-array normalisation, so the inherited
     * constructor ignores named arguments: without this one, overriding the
     * message at the call site would raise an unknown named parameter error.
     *
     * @param string[]|null $groups
     */
    public function __construct(?string $message = null, ?array $groups = null, mixed $payload = null)
    {
        parent::__construct(null, $groups, $payload);

        $this->message = $message ?? $this->message;
    }
}
