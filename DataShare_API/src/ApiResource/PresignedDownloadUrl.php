<?php

namespace App\ApiResource;

final readonly class PresignedDownloadUrl
{
    public function __construct(
        public string $presignedUrl,
        public int $expiresIn,
    ) {
    }
}
