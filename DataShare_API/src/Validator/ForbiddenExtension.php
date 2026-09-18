<?php

namespace App\Validator;

use Symfony\Component\Validator\Constraint;

#[\Attribute(\Attribute::TARGET_PROPERTY)]
class ForbiddenExtension extends Constraint
{
    public string $message = 'L\'extension ".{{ extension }}" n\'est pas autorisee.';
}
