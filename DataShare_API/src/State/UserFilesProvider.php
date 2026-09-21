<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\File;
use App\Entity\User;
use App\Repository\FileRepository;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * @implements ProviderInterface<File>
 */
final readonly class UserFilesProvider implements ProviderInterface
{
    public function __construct(
        private FileRepository $fileRepository,
        private Security $security,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     *
     * @return list<File>
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): array
    {
        $owner = $this->security->getUser();
        if (!$owner instanceof User) {
            throw new \LogicException('The file list operation requires an authenticated user.');
        }

        return $this->fileRepository->findByOwner($owner, $this->tagFilter($context));
    }

    /**
     * An empty tag is read as no filter at all: a cleared input in the
     * front-end sends the parameter with an empty value rather than dropping
     * it, and no tag can be named "".
     *
     * @param array<string, mixed> $context
     */
    private function tagFilter(array $context): ?string
    {
        $filters = $context['filters'] ?? [];
        $tag = is_array($filters) ? $filters['tag'] ?? null : null;

        if (!is_string($tag) || '' === trim($tag)) {
            return null;
        }

        return trim($tag);
    }
}
