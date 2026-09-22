<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\ApiResource\TagInput;
use App\Entity\File;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Attaches a tag to a file already uploaded: POST /api/files/{id}/tags.
 *
 * @implements ProcessorInterface<TagInput, File>
 */
final readonly class FileTagAddProcessor implements ProcessorInterface
{
    use FileTagOperationTrait;

    /**
     * @param ProcessorInterface<File, File> $persistProcessor
     */
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        private TagResolver $tagResolver,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): File
    {
        $file = $this->readFile($context);
        $owner = $this->ownerOf($file);
        $tagName = trim((string) $data->tag);

        if (null !== $file->findTag($tagName)) {
            $this->rejectDuplicate($tagName);
        }

        $file->addTag($this->tagResolver->resolve($owner, $tagName));

        return $this->persistProcessor->process($file, $operation, $uriVariables, $context);
    }
}
