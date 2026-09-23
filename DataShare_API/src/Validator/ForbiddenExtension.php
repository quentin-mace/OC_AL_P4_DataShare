<?php

namespace App\Validator;

use Symfony\Component\Validator\Constraint;

#[\Attribute(\Attribute::TARGET_PROPERTY)]
class ForbiddenExtension extends Constraint
{
    public string $message = 'The ".{{ extension }}" extension is not allowed.';
}
