<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\File;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Removes a tag from a file: DELETE /api/files/{id}/tags/{tag}.
 *
 * The persist processor and not the remove one: the file survives, only its
 * association does not. Its flush-then-refresh is also what makes the response
 * list the tags as they stand once an orphan tag has been collected.
 *
 * @implements ProcessorInterface<File, File>
 */
final readonly class FileTagRemoveProcessor implements ProcessorInterface
{
    use FileTagOperationTrait;

    /**
     * @param ProcessorInterface<File, File> $persistProcessor
     */
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): File
    {
        $file = $this->readFile($context);
        $tagName = $uriVariables['tag'] ?? null;

        if (!is_string($tagName)) {
            // The route only matches when {tag} is present, so this would be a
            // misconfiguration rather than a client error.
            throw new \LogicException('The tag removal operation requires a tag URI variable.');
        }

        $tag = $file->findTag($tagName);

        if (null === $tag) {
            // See FileTagRenameProcessor: raising this in the provider would
            // leak the tags of other accounts' files.
            throw new NotFoundHttpException(sprintf('The "%s" tag is not on this file.', $tagName));
        }

        $file->detachTag($tag);

        return $this->persistProcessor->process($file, $operation, $uriVariables, $context);
    }
}
