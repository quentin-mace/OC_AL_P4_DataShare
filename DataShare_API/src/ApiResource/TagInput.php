<?php

namespace App\ApiResource;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * The body of POST /api/files/{id}/tags and PUT /api/files/{id}/tags/{tag}.
 *
 * Only the input rules live here. "Not already on this file" depends on the
 * file behind the URI, which this DTO knows nothing about, so that one is
 * enforced by the processors.
 */
final class TagInput
{
    /**
     * Trimmed before validating, to match UserFilesProvider::tagFilter() which
     * already trims the history filter; the processors trim before resolving.
     */
    #[Assert\NotBlank(message: 'Un tag est requis.', normalizer: 'trim')]
    #[Assert\Length(max: 30, normalizer: 'trim')]
    public ?string $tag = null;
}
