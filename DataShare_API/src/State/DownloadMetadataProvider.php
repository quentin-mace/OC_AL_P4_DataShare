<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\File;

/**
 * @implements ProviderInterface<File>
 */
final readonly class DownloadMetadataProvider implements ProviderInterface
{
    public function __construct(private DownloadFileResolver $resolver)
    {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): File
    {
        return $this->resolver->resolve($uriVariables['downloadToken']);
    }
}
